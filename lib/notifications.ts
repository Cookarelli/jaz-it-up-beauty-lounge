import "server-only";
import { integrations } from "./integrations";
import { env } from "./env";
import { emailReady, smsReady } from "./integration-config";
import { privilegedClient } from "./supabase";
import { preferenceToken, hashToken } from "./capabilities";
import {
  ResendAdapter,
  TwilioAdapter,
  type SendBody,
} from "./communications/adapters";
import {
  renderMessage,
  type MessageKind,
  type MessagePayload,
} from "./communications/templates";
export async function processNotifications() {
  const db = privilegedClient();
  let accepted = 0,
    attempted = 0;
  for (const channel of ["email", "sms"] as const) {
    if (
      channel === "email" ? !emailReady(integrations) : !smsReady(integrations)
    )
      continue;
    const adapter =
      channel === "email"
        ? new ResendAdapter(integrations.RESEND_API_KEY!)
        : new TwilioAdapter(
            integrations.TWILIO_ACCOUNT_SID!,
            integrations.TWILIO_AUTH_TOKEN!,
          );
    const { data, error } = await db.rpc("claim_messages", {
      p_channel: channel,
    });
    if (error) throw Error("Queue unavailable");
    for (const job of data || []) {
      const payload = job.payload as MessagePayload;
      const origin = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
      const token =
        channel === "email"
          ? preferenceToken(
              job.appointment_id,
              Math.floor(Date.parse(payload.starts_at) / 1000) + 86400 * 30,
              integrations.NOTIFICATION_LINK_SECRET!,
            )
          : "";
      const message = renderMessage(
        job.kind as MessageKind,
        payload,
        `${origin}/preferences#${token}`,
      );
      const body: SendBody =
        channel === "email"
          ? {
              to: payload.email!,
              from: `Jaz It Up Beauty Lounge <${integrations.RESEND_FROM_EMAIL}>`,
              subject: message.subject,
              html: message.html,
              text: message.text,
            }
          : {
              to: payload.phone,
              text: message.sms,
              messagingService: integrations.TWILIO_MESSAGING_SERVICE_SID,
              callback: `${origin}/api/webhooks/twilio`,
            };
      body.configurationFingerprint = hashToken(
        channel === "email"
          ? integrations.RESEND_API_KEY!
          : `${integrations.TWILIO_ACCOUNT_SID}:${integrations.TWILIO_AUTH_TOKEN}`,
      );
      // Store the exact request body before the first network call; retries cannot drift.
      const frozen = await db.rpc("freeze_message", {
        p_id: job.id,
        p_lease: job.lease_token,
        p_provider: adapter.provider,
        p_body: body,
      });
      if (frozen.error) {
        await db.rpc("finish_message", {
          p_id: job.id,
          p_lease: job.lease_token,
          p_state: "unknown",
          p_error:
            "Could not safely freeze provider request; operator review required",
        });
        continue;
      }
      if (!frozen.data) continue;
      const result = await adapter.send(job.id, frozen.data as SendBody);
      attempted++;
      const saved = await db.rpc("finish_message", {
        p_id: job.id,
        p_lease: job.lease_token,
        p_state: result.state,
        p_provider_id: result.providerId ?? null,
        p_error: result.error ?? null,
      });
      if (saved.error) throw Error("Delivery acknowledgement unavailable");
      if (result.state === "accepted" && saved.data) accepted++;
    }
  }
  return { attempted, accepted };
}
