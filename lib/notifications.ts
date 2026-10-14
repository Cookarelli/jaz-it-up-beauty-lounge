import "server-only";
import { env } from "./env";
export type Notification = {
  id: string;
  kind: "confirmation" | "reminder";
  payload: {
    email: string;
    name: string;
    starts_at: string;
    reference: string;
  };
};
export interface NotificationAdapter {
  send(message: Notification): Promise<void>;
}
export class WebhookAdapter implements NotificationAdapter {
  async send(message: Notification) {
    if (!env.NOTIFICATION_WEBHOOK_URL || !env.NOTIFICATION_WEBHOOK_TOKEN)
      throw Error("Notification provider not configured");
    const r = await fetch(env.NOTIFICATION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.NOTIFICATION_WEBHOOK_TOKEN}`,
        "Idempotency-Key": message.id,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw Error("Notification delivery failed");
  }
}
