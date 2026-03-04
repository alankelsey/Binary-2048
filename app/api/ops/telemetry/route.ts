import { NextResponse } from "next/server";
import { getOpsTelemetrySnapshot } from "@/lib/binary2048/ops-telemetry";

export async function GET() {
  return NextResponse.json(getOpsTelemetrySnapshot(), { status: 200 });
}

