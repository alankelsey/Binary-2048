import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "binary-2048",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev"
  });
}
