import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { getPassiveStorageStatus } from "@/lib/binary2048/ops-storage-status";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(getPassiveStorageStatus(), {
    status: 200,
    headers: { "cache-control": "no-store" }
  });
}
