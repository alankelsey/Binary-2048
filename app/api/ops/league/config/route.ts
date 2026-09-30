import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import {
  getLeagueConfig,
  mirrorProductionConfigIntoSandbox,
  promoteSandboxConfigToProduction
} from "@/lib/binary2048/league-config";

type LeagueConfigActionBody = {
  action?: "mirror" | "promote";
};

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }
  return NextResponse.json(
    {
      source: { scope: "runtime", readOnly: true },
      production: getLeagueConfig("production"),
      sandbox: getLeagueConfig("sandbox")
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
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
