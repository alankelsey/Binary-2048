import { getReplayCodeFromSearch } from "@/lib/binary2048/replay-link";

describe("getReplayCodeFromSearch", () => {
  it("reads primary code parameter", () => {
    expect(getReplayCodeFromSearch("?code=abc123")).toBe("abc123");
  });

  it("falls back to legacy replayCode parameter", () => {
    expect(getReplayCodeFromSearch("?replayCode=legacy")).toBe("legacy");
  });

  it("returns null when code is missing or blank", () => {
    expect(getReplayCodeFromSearch("")).toBeNull();
    expect(getReplayCodeFromSearch("?code=   ")).toBeNull();
  });
});
