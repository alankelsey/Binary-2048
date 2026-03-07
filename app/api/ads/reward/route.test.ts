import { POST } from "@/app/api/ads/reward/route";
import { createAdRewardSignature, resetAdRewardStore } from "@/lib/binary2048/ad-rewards";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { getInventory, resetInventoryStore } from "@/lib/binary2048/inventory";

function signedRequest(payload: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  const raw = JSON.stringify(payload);
  const signature = createAdRewardSignature(raw, process.env.BINARY2048_AD_REWARD_SECRET ?? "");
  return new Request("http://localhost/api/ads/reward", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-binary2048-ad-sig": signature,
      ...extraHeaders
    },
    body: raw
  });
}

describe("POST /api/ads/reward", () => {
  beforeEach(() => {
    process.env.BINARY2048_ADS_ENABLED = "1";
    process.env.BINARY2048_AD_REWARD_SECRET = "ad-reward-secret";
    process.env.BINARY2048_AD_REWARD_DAILY_CAP = "2";
    process.env.BINARY2048_AD_REWARD_COOLDOWN_SEC = "60";
    process.env.BINARY2048_AD_REWARD_MAX_SKEW_SEC = "300";
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "auth-bridge-secret";
    resetInventoryStore();
    resetAdRewardStore();
  });

  it("grants reward with valid signature and payload", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const req = signedRequest({
      subscriberId: "ad-user-1",
      sku: "undo_charge",
      quantity: 1,
      nonce: "nonce_12345678",
      timestampSec: nowSec
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.inventory?.balances?.undo_charge).toBe(1);
    expect(json.ledgerEntry?.reason).toBe("ad_reward");
  });

  it("rejects invalid signature", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const req = new Request("http://localhost/api/ads/reward", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-binary2048-ad-sig": "bad-signature"
      },
      body: JSON.stringify({
        subscriberId: "ad-user-1",
        sku: "undo_charge",
        quantity: 1,
        nonce: "nonce_abc12345",
        timestampSec: nowSec
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.code).toBe("invalid_signature");
  });

  it("rejects nonce replay", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      subscriberId: "ad-user-2",
      sku: "undo_charge",
      quantity: 1,
      nonce: "nonce_replay_1",
      timestampSec: nowSec
    };
    const first = await POST(signedRequest(payload));
    const second = await POST(signedRequest(payload));
    const secondJson = await second.json();
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(secondJson.code).toBe("replay_nonce");
  });

  it("enforces cooldown and daily cap", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const first = await POST(
      signedRequest({
        subscriberId: "ad-user-3",
        sku: "undo_charge",
        quantity: 1,
        nonce: "nonce_cd_111111",
        timestampSec: nowSec
      })
    );
    const cooldownRes = await POST(
      signedRequest({
        subscriberId: "ad-user-3",
        sku: "undo_charge",
        quantity: 1,
        nonce: "nonce_cd_222222",
        timestampSec: nowSec
      })
    );
    const cooldownJson = await cooldownRes.json();
    expect(first.status).toBe(200);
    expect(cooldownRes.status).toBe(429);
    expect(cooldownJson.code).toBe("cooldown_active");

    process.env.BINARY2048_AD_REWARD_COOLDOWN_SEC = "1";
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const okSecond = await POST(
      signedRequest({
        subscriberId: "ad-user-3",
        sku: "undo_charge",
        quantity: 1,
        nonce: "nonce_cd_333333",
        timestampSec: nowSec
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const capRes = await POST(
      signedRequest({
        subscriberId: "ad-user-3",
        sku: "undo_charge",
        quantity: 1,
        nonce: "nonce_cd_444444",
        timestampSec: nowSec
      })
    );
    const capJson = await capRes.json();
    expect(okSecond.status).toBe(200);
    expect(capRes.status).toBe(429);
    expect(capJson.code).toBe("daily_cap_reached");
    expect(getInventory("ad-user-3").balances.undo_charge).toBe(2);
  });

  it("blocks paid tier from receiving ad rewards", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = createAuthBridgeToken(
      {
        sub: "ad-paid-user",
        exp: nowSec + 60,
        tier: "paid"
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? ""
    );
    const res = await POST(
      signedRequest(
        {
          subscriberId: "ad-paid-user",
          sku: "undo_charge",
          quantity: 1,
          nonce: "nonce_paid_1",
          timestampSec: nowSec
        },
        { authorization: `Bearer ${token}` }
      )
    );
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.code).toBe("paid_tier_ad_free");
  });
});
