import { clampReplayStep, parseReplayStepInput } from "@/lib/binary2048/replay-scrubber";

describe("replay scrubber helpers", () => {
  it("clamps steps within 0..total bounds", () => {
    expect(clampReplayStep(-5, 9)).toBe(0);
    expect(clampReplayStep(2, 9)).toBe(2);
    expect(clampReplayStep(99, 9)).toBe(9);
  });

  it("parses and clamps slider input", () => {
    expect(parseReplayStepInput("3", 10)).toBe(3);
    expect(parseReplayStepInput("100", 10)).toBe(10);
    expect(parseReplayStepInput("nope", 10)).toBe(0);
  });
});
