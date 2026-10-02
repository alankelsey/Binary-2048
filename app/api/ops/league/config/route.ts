import { opsSource } from "@/lib/binary2048/ops-shared";
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
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(
    {
      source: opsSource(),
      production: (await getLeagueConfig("production")),
      sandbox: (await getLeagueConfig("sandbox"))
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const body = ((await req.json().catch(() => ({}))) as LeagueConfigActionBody);
  if (body.action === "mirror") {
    const sandbox = (await mirrorProductionConfigIntoSandbox());
    return NextResponse.json({ action: "mirror", sandbox }, { status: 200 });
  }
  if (body.action === "promote") {
    const production = (await promoteSandboxConfigToProduction());
    return NextResponse.json({ action: "promote", production }, { status: 200 });
  }
  return NextResponse.json({ error: "action must be mirror or promote" }, { status: 400 });
}
