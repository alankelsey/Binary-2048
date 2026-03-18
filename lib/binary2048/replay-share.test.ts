import { buildReplayUrl, getReplayShareErrorMessage } from "@/lib/binary2048/replay-share";

describe("buildReplayUrl", () => {
  it("builds /replay link with encoded code", () => {
    const url = buildReplayUrl("https://binary2048.com", "ab+c/==");
    expect(url).toBe("https://binary2048.com/replay?code=ab%2Bc%2F%3D%3D");
  });

  it("normalizes trailing slash on origin", () => {
    const url = buildReplayUrl("https://binary2048.com/", "abc");
    expect(url).toBe("https://binary2048.com/replay?code=abc");
  });

  it("returns a specific message for stale missing runs", () => {
    expect(getReplayShareErrorMessage(404)).toContain("no longer available");
  });

  it("returns a generic message for other replay export failures", () => {
    expect(getReplayShareErrorMessage(500)).toBe("Failed to create replay link");
  });
});
