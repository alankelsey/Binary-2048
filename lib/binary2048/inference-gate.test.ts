import { runInferenceWithSafetyGate } from "@/lib/binary2048/inference-gate";

describe("inference safety gate", () => {
  it("returns model value when inference completes before timeout", async () => {
    const logs: string[] = [];
    const result = await runInferenceWithSafetyGate({
      seed: 77,
      timeoutMs: 100,
      modelId: "bot.alpha",
      modelVersion: "v1",
      run: async () => "L",
      fallback: () => "U",
      onLog: (event) => logs.push(event.event)
    });
    expect(result.value).toBe("L");
    expect(result.fallbackUsed).toBe(false);
    expect(result.seed).toBe(77);
    expect(logs).toContain("inference_success");
  });

  it("falls back when inference times out", async () => {
    const logs: string[] = [];
    const result = await runInferenceWithSafetyGate({
      seed: 88,
      timeoutMs: 5,
      modelId: "bot.alpha",
      modelVersion: "v1",
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return "R";
      },
      fallback: () => "D",
      onLog: (event) => logs.push(event.event)
    });
    expect(result.value).toBe("D");
    expect(result.fallbackUsed).toBe(true);
    expect(result.timedOut).toBe(true);
    expect(logs).toContain("inference_timeout");
  });

  it("falls back when inference throws", async () => {
    const logs: string[] = [];
    const result = await runInferenceWithSafetyGate({
      seed: 99,
      timeoutMs: 50,
      modelId: "bot.alpha",
      modelVersion: "v1",
      run: async () => {
        throw new Error("boom");
      },
      fallback: () => "L",
      onLog: (event) => logs.push(event.event)
    });
    expect(result.value).toBe("L");
    expect(result.fallbackUsed).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(logs).toContain("inference_error");
  });
});
