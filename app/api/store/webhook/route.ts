import { NextResponse } from "next/server";
import Stripe from "stripe";
import { processStoreWebhookEvent } from "@/lib/binary2048/store-webhook";

const stripe = new Stripe("not_used_for_webhook_verification");
const STORE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Store webhook is not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Invalid Stripe webhook signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
      STORE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
    );
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature" }, { status: 400 });
  }

  try {
    const processed = processStoreWebhookEvent(event);
    return NextResponse.json(processed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook event" },
      { status: 400 }
    );
  }
}
