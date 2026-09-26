import { POST } from "@/app/api/store/webhook/route";
import { getInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { resetStoreWebhookState } from "@/lib/binary2048/store-webhook";
import Stripe from "stripe";

const stripe = new Stripe("not_used_for_webhook_tests");
const webhookSecret = "whsec_store_route_test";

function signedRequest(body: string, options?: { timestamp?: number; signature?: string }) {
  const signature = options?.signature ?? stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: webhookSecret,
    timestamp: options?.timestamp
  });
  return new Request("http://localhost/api/store/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature
    },
    body
  });
}

describe("api store webhook", () => {
  beforeEach(() => {
    resetStoreWebhookState();
    resetInventoryStore();
  });

  afterEach(() => {
    delete process.env.BINARY2048_STORE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("accepts a valid Stripe signature over the raw body and processes idempotent grants", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const body = {
      id: "evt_api_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_api_1",
          payment_intent: "pi_api_1",
          metadata: {
            subscriberId: "api-webhook-user",
            packetSku: "pack_undo_starter",
            quantity: "1"
          }
        }
      }
    };

    const firstBody = JSON.stringify(body, null, 2);
    const first = await POST(signedRequest(firstBody));
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.idempotent).toBe(false);

    const duplicateBody = JSON.stringify({ ...body, id: "evt_api_2" });
    const duplicate = await POST(signedRequest(duplicateBody));
    const dupJson = await duplicate.json();
    expect(duplicate.status).toBe(200);
    expect(dupJson.idempotent).toBe(true);
    expect(getInventory("api-webhook-user").balances.undo_charge).toBe(3);
  });

  it("rejects a signature if the raw body is changed", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const original = JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: original,
      secret: webhookSecret
    });
    const tampered = JSON.stringify({ id: "evt_tampered", type: "checkout.session.completed" });
    const res = await POST(signedRequest(tampered, { signature }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid Stripe webhook signature" });
    expect(getInventory("api-webhook-user").balances.undo_charge).toBe(0);
  });

  it("rejects missing and stale Stripe signatures", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    const body = JSON.stringify({ id: "evt_stale", type: "customer.created" });
    const missing = await POST(new Request("http://localhost/api/store/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    }));
    expect(missing.status).toBe(400);

    const stale = await POST(signedRequest(body, {
      timestamp: Math.floor(Date.now() / 1000) - 301
    }));
    expect(stale.status).toBe(400);
  });

  it("fails closed when the webhook secret is not configured", async () => {
    const res = await POST(
      new Request("http://localhost/api/store/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "evt_unconfigured", type: "checkout.session.completed" })
      })
    );
    expect(res.status).toBe(503);
  });

  it("does not accept the removed placeholder shared-secret header", async () => {
    process.env.BINARY2048_STORE_WEBHOOK_SECRET = "legacy-secret";
    const res = await POST(new Request("http://localhost/api/store/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-store-webhook-secret": "legacy-secret"
      },
      body: JSON.stringify({ id: "evt_legacy", type: "customer.created" })
    }));
    expect(res.status).toBe(503);
  });
});
