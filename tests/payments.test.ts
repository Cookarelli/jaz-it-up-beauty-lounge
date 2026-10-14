import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import {
  depositAmount,
  remainingBalance,
  paymentOutcome,
} from "../lib/payments/core";
import { verifyStripeEvent } from "../lib/payments/webhook";
import { integrationSchema, paymentsReady } from "../lib/integration-config";
test("deposit calculation uses integer cents, caps fixed amounts and rounds percentages up", () => {
  assert.equal(depositAmount(6000, "none", null), 0);
  assert.equal(depositAmount(6000, "fixed", 2000), 2000);
  assert.equal(depositAmount(1000, "fixed", 2000), 1000);
  assert.equal(depositAmount(6001, "percent", 25), 1501);
  assert.throws(() => depositAmount(6000, "percent", 101));
  assert.throws(() => depositAmount(10, "fixed", 100));
  assert.throws(() => depositAmount(-1, "fixed", 100));
  assert.equal(remainingBalance(6000, 2000, 500), 4500);
});
test("opening or returning from Checkout cannot prove a paid booking", () => {
  assert.equal(
    paymentOutcome({ status: "open", payment_status: "unpaid" }),
    "pending",
  );
  assert.equal(
    paymentOutcome({ status: "complete", payment_status: "unpaid" }),
    "pending",
  );
  assert.equal(
    paymentOutcome({ status: "complete", payment_status: "paid" }),
    "paid",
  );
  assert.equal(
    paymentOutcome({ status: "expired", payment_status: "unpaid" }),
    "expired",
  );
});
test("Stripe webhook requires authentic signature, untampered raw body and correct mode", () => {
  const secret = "whsec_fixture_only",
    raw = JSON.stringify({
      id: "evt_fixture",
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { id: "cs_fixture" } },
    });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret,
  });
  assert.equal(
    verifyStripeEvent(raw, signature, secret, false).id,
    "evt_fixture",
  );
  assert.throws(() => verifyStripeEvent(raw + " ", signature, secret, false));
  assert.throws(() => verifyStripeEvent(raw, signature, "wrong", false));
  assert.throws(() => verifyStripeEvent(raw, signature, secret, true));
});
test("credentials alone never enable payments; live/test mismatch fails closed", () => {
  const c = {
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_WEBHOOK_ENDPOINT_ID: "we_fixture",
  };
  assert.equal(paymentsReady(integrationSchema.parse(c)), false);
  assert.equal(
    paymentsReady(integrationSchema.parse({ ...c, PAYMENTS_ENABLED: "true" })),
    true,
  );
  assert.equal(
    paymentsReady(
      integrationSchema.parse({
        ...c,
        PAYMENTS_ENABLED: "true",
        STRIPE_MODE: "live",
      }),
    ),
    false,
  );
});
