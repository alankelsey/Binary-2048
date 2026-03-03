import { NextResponse } from "next/server";
import { OPENAPI_SPEC } from "@/lib/binary2048/openapi";

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, { status: 200 });
}
