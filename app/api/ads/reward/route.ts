import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import {
  AdRewardGrantError,
  grantVerifiedAdReward,
  verifyAdRewardSignature
} from "@/lib/binary2048/ad-rewards";
import type { StoreSku } from "@/lib/binary2048/inventory";

const MAX_BODY_BYTES = 8 * 1024;

type RewardBody = {
  subscriberId?: string;
  sku?: StoreSku;
  quantity?: number;
  nonce?: string;
  timestampSec?: number;
};

function parseBody(raw: string): RewardBody {
  try {
    return JSON.parse(raw) as RewardBody;
  } catch {
    throw new AdRewardGrantError("Invalid JSON payload", 400, "invalid_json");
  }
}

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new AdRewardGrantError("Request body too large", 413, "body_too_large");
    }

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      throw new AdRewardGrantError("Request body too large", 413, "body_too_large");
    }

    const body = parseBody(raw);
    const signature = req.headers.get("x-binary2048-ad-sig") ?? "";
    const secret = process.env.BINARY2048_AD_REWARD_SECRET ?? "";
    if (!verifyAdRewardSignature(raw, signature, secret)) {
      throw new AdRewardGrantError("Invalid reward signature", 401, "invalid_signature");
    }

    const claims = getVerifiedAuthClaims(req);
    const subscriberId = String(body.subscriberId ?? "").trim();
    if (!subscriberId) {
      throw new AdRewardGrantError("subscriberId is required", 400, "missing_subscriber");
    }
    if (claims?.sub && claims.sub !== subscriberId) {
      throw new AdRewardGrantError("subscriber mismatch", 403, "subscriber_mismatch");
    }

    const tier = claims?.tier ?? "guest";
    const sku = (body.sku ?? "undo_charge") as StoreSku;
    const quantity = Number.isInteger(body.quantity) ? Number(body.quantity) : 1;
    const timestampSec = Number(body.timestampSec);
    const nonce = String(body.nonce ?? "");

    const granted = grantVerifiedAdReward({
      subscriberId,
      tier,
      sku,
      quantity,
      nonce,
      timestampSec
    });

    return NextResponse.json(granted, { status: 200 });
  } catch (error) {
    if (error instanceof AdRewardGrantError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid reward payload" },
      { status: 400 }
    );
  }
}
