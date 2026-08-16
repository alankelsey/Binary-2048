import { createHash } from "crypto";
import { resolveBotApiKey } from "@/lib/binary2048/bot-api-key";

function hash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

describe("bot api key", () => {
  it("resolves a configured raw key to its non-secret bot id", () => {
    const rawKey = "b2048_test-secret";
    expect(resolveBotApiKey(rawKey, `research-bot=${hash(rawKey)}`)).toEqual({ id: "research-bot" });
  });

  it("rejects unknown keys and malformed configuration entries", () => {
    expect(resolveBotApiKey("unknown", `research-bot=${hash("different")}`)).toBeNull();
    expect(resolveBotApiKey("secret", "bad id=not-a-hash")).toBeNull();
    expect(resolveBotApiKey("secret", undefined)).toBeNull();
  });

  it("rejects oversized presented keys", () => {
    expect(resolveBotApiKey("x".repeat(513), `research-bot=${hash("x".repeat(513))}`)).toBeNull();
  });
});
