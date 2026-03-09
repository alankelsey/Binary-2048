import { NextResponse } from "next/server";
import {
  getLeagueConfig,
  mirrorProductionConfigIntoSandbox,
  promoteSandboxConfigToProduction
} from "@/lib/binary2048/league-config";

type LeagueConfigActionBody = {
  action?: "mirror" | "promote";
};

function isAdmin(req: Request) {
  const expected = process.env.BINARY2048_ADMIN_TOKEN ?? "";
  if (!expected) return false;
  const provided = req.headers.get("x-admin-token") ?? "";
  return provided === expected;
}

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
  }
  return NextResponse.json(
    {
      production: getLeagueConfig("production"),
      sandbox: getLeagueConfig("sandbox")
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
  }
  const body = ((await req.json().catch(() => ({}))) as LeagueConfigActionBody);
  if (body.action === "mirror") {
    const sandbox = mirrorProductionConfigIntoSandbox();
    return NextResponse.json({ action: "mirror", sandbox }, { status: 200 });
  }
  if (body.action === "promote") {
    const production = promoteSandboxConfigToProduction();
    return NextResponse.json({ action: "promote", production }, { status: 200 });
  }
  return NextResponse.json({ error: "action must be mirror or promote" }, { status: 400 });
}

