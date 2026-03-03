import { replaySpeedToDelayMs } from "@/lib/binary2048/replay-autoplay";

describe("replaySpeedToDelayMs", () => {
  it("maps speed 1..10 to delays", () => {
    expect(replaySpeedToDelayMs(1)).toBe(1000);
    expect(replaySpeedToDelayMs(5)).toBe(600);
    expect(replaySpeedToDelayMs(10)).toBe(100);
  });

  it("clamps out-of-range speed values", () => {
    expect(replaySpeedToDelayMs(0)).toBe(1000);
    expect(replaySpeedToDelayMs(99)).toBe(100);
  });
});
