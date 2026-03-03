import { buildReplayUrl } from "@/lib/binary2048/replay-share";

describe("buildReplayUrl", () => {
  it("builds /replay link with encoded code", () => {
    const url = buildReplayUrl("https://binary2048.com", "ab+c/==");
    expect(url).toBe("https://binary2048.com/replay?code=ab%2Bc%2F%3D%3D");
  });

  it("normalizes trailing slash on origin", () => {
    const url = buildReplayUrl("https://binary2048.com/", "abc");
    expect(url).toBe("https://binary2048.com/replay?code=abc");
  });
});
