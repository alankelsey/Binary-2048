export type InferenceOutcome<T> = {
  value: T;
  fallbackUsed: boolean;
  timedOut: boolean;
  elapsedMs: number;
  seed: number;
  modelId: string;
  modelVersion: string;
};

export type InferenceRequest<T> = {
  seed: number;
  timeoutMs: number;
  modelId: string;
  modelVersion: string;
  run: () => Promise<T>;
  fallback: () => T;
  onLog?: (event: {
    event: "inference_success" | "inference_timeout" | "inference_error";
    seed: number;
    modelId: string;
    modelVersion: string;
    elapsedMs: number;
  }) => void;
};

export async function runInferenceWithSafetyGate<T>(request: InferenceRequest<T>): Promise<InferenceOutcome<T>> {
  const started = Date.now();
  let timedOut = false;

  const timeoutPromise = new Promise<T>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve(request.fallback());
    }, Math.max(1, request.timeoutMs));
  });

  try {
    const value = await Promise.race([request.run(), timeoutPromise]);
    const elapsedMs = Date.now() - started;
    request.onLog?.({
      event: timedOut ? "inference_timeout" : "inference_success",
      seed: request.seed,
      modelId: request.modelId,
      modelVersion: request.modelVersion,
      elapsedMs
    });
    return {
      value,
      fallbackUsed: timedOut,
      timedOut,
      elapsedMs,
      seed: request.seed,
      modelId: request.modelId,
      modelVersion: request.modelVersion
    };
  } catch {
    const elapsedMs = Date.now() - started;
    const value = request.fallback();
    request.onLog?.({
      event: "inference_error",
      seed: request.seed,
      modelId: request.modelId,
      modelVersion: request.modelVersion,
      elapsedMs
    });
    return {
      value,
      fallbackUsed: true,
      timedOut: false,
      elapsedMs,
      seed: request.seed,
      modelId: request.modelId,
      modelVersion: request.modelVersion
    };
  }
}
