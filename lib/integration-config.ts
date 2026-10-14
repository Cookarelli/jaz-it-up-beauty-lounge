import { z } from "zod";
const optional = z.string().min(1).optional();
const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export const integrationSchema = z.object({
  NOTIFICATIONS_ENABLED: flag,
  EMAIL_PROVIDER: z.enum(["disabled", "resend"]).default("disabled"),
  RESEND_API_KEY: optional,
  RESEND_FROM_EMAIL: z.email().optional(),
  RESEND_WEBHOOK_SECRET: optional,
  NOTIFICATION_LINK_SECRET: z.string().min(32).optional(),
  SMS_ENABLED: flag,
  TWILIO_ACCOUNT_SID: z
    .string()
    .regex(/^AC[a-f0-9]{32}$/i)
    .optional(),
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_MESSAGING_SERVICE_SID: z
    .string()
    .regex(/^MG[a-f0-9]{32}$/i)
    .optional(),
  PAYMENTS_ENABLED: flag,
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_/)
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_WEBHOOK_ENDPOINT_ID: z.string().startsWith("we_").optional(),
  STRIPE_MODE: z.enum(["test", "live"]).default("test"),
});
export type IntegrationConfig = z.infer<typeof integrationSchema>;
export function emailReady(c: IntegrationConfig) {
  return (
    c.NOTIFICATIONS_ENABLED &&
    c.EMAIL_PROVIDER === "resend" &&
    !!(
      c.RESEND_API_KEY &&
      c.RESEND_FROM_EMAIL &&
      c.RESEND_WEBHOOK_SECRET &&
      c.NOTIFICATION_LINK_SECRET
    )
  );
}
export function smsReady(c: IntegrationConfig) {
  return (
    c.NOTIFICATIONS_ENABLED &&
    c.SMS_ENABLED &&
    !!(
      c.TWILIO_ACCOUNT_SID &&
      c.TWILIO_AUTH_TOKEN &&
      c.TWILIO_MESSAGING_SERVICE_SID
    )
  );
}
export function stripeConfigured(c: IntegrationConfig) {
  return !!(
    c.STRIPE_SECRET_KEY?.startsWith(`sk_${c.STRIPE_MODE}_`) &&
    c.STRIPE_WEBHOOK_SECRET &&
    c.STRIPE_WEBHOOK_ENDPOINT_ID
  );
}
export function paymentsReady(c: IntegrationConfig) {
  return c.PAYMENTS_ENABLED && stripeConfigured(c);
}
