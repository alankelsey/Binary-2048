import { NextResponse } from "next/server";
import { listStorePackets } from "@/lib/binary2048/store-catalog";

export async function GET() {
  return NextResponse.json({
    packets: listStorePackets()
  });
}
