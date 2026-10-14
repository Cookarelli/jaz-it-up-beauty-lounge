import { createHmac } from "node:crypto";
import { secureEqual } from "../capabilities";
export type SendBody = {
  to: string;
  from?: string;
  subject?: string;
  html?: string;
  text: string;
  callback?: string;
  messagingService?: string;
  configurationFingerprint?: string;
};
export type SendResult = {
  state: "accepted" | "retry" | "failed" | "unknown";
  providerId?: string;
  error?: string;
};
export interface NotificationAdapter {
  readonly provider: string;
  send(id: string, body: SendBody): Promise<SendResult>;
}
export class ResendAdapter implements NotificationAdapter {
  readonly provider = "resend";
  constructor(
    private key: string,
    private transport: typeof fetch = fetch,
  ) {}
  async send(id: string, body: SendBody): Promise<SendResult> {
    try {
      const r = await this.transport("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": id,
        },
        body: JSON.stringify({
          from: body.from,
          to: [body.to],
          subject: body.subject,
          html: body.html,
          text: body.text,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok)
        return {
          state:
            r.status === 429 || r.status >= 500 || r.status === 409
              ? "retry"
              : "failed",
          error: `resend_http_${r.status}`,
        };
      const result = await r.json();
      return typeof result.id === "string"
        ? { state: "accepted", providerId: result.id }
        : { state: "retry", error: "resend_invalid_response" };
    } catch {
      return { state: "retry", error: "resend_acceptance_uncertain" };
    }
  }
}
export class TwilioAdapter implements NotificationAdapter {
  readonly provider = "twilio";
  constructor(
    private account: string,
    private token: string,
    private transport: typeof fetch = fetch,
  ) {}
  async send(_id: string, body: SendBody): Promise<SendResult> {
    try {
      const r = await this.transport(
        `https://api.twilio.com/2010-04-01/Accounts/${this.account}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.account}:${this.token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: body.to,
            Body: body.text,
            MessagingServiceSid: body.messagingService!,
            StatusCallback: body.callback!,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      // Twilio message creation has no assumed idempotency guarantee. Never replay an ambiguous send.
      if (!r.ok)
        return {
          state: r.status >= 500 ? "unknown" : "failed",
          error: `twilio_http_${r.status}`,
        };
      const result = await r.json();
      return typeof result.sid === "string"
        ? { state: "accepted", providerId: result.sid }
        : { state: "unknown", error: "twilio_invalid_response" };
    } catch {
      return { state: "unknown", error: "twilio_acceptance_uncertain" };
    }
  }
}
export function verifyTwilio(
  url: string,
  params: Record<string, string>,
  signature: string,
  token: string,
) {
  const value =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return secureEqual(
    createHmac("sha1", token).update(value).digest("base64"),
    signature,
  );
}
