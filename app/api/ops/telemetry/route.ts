import { opsSource } from "@/lib/binary2048/ops-shared";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { getFleetTelemetry } from "@/lib/binary2048/ops-telemetry";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(
    { source: opsSource(), ...await getFleetTelemetry() },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
