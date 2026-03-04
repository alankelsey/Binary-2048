import { NextResponse } from "next/server";
import { normalizeEnginePinMode } from "@/lib/binary2048/engine-version-policy";
import { validateReplay } from "@/lib/binary2048/replay-validate";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { signature?: unknown; payload?: unknown };
    const hasNestedPayload =
      typeof body === "object" &&
      body !== null &&
      Object.prototype.hasOwnProperty.call(body, "payload");
    const signature =
      typeof body === "object" && body !== null && typeof body.signature === "string" ? body.signature : undefined;
    const payload = hasNestedPayload ? body.payload : body;
    const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET;
    const expectedEngineVersion = process.env.BINARY2048_ENGINE_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION;
    const enginePinMode = normalizeEnginePinMode(process.env.BINARY2048_REPLAY_ENGINE_PIN_MODE);
    const result = validateReplay(payload, { signature, signingSecret, expectedEngineVersion, enginePinMode });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "Invalid replay payload" },
      { status: 400 }
    );
  }
}
