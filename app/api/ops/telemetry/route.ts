import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { getOpsTelemetrySnapshot } from "@/lib/binary2048/ops-telemetry";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(
    { source: { scope: "runtime", readOnly: true }, ...getOpsTelemetrySnapshot() },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
