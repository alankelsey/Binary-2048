import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { listRegisteredModels } from "@/lib/binary2048/model-registry";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }
  const models = listRegisteredModels().map(({ modelId, family, version, rulesetId, createdAtISO, active }) => ({
    modelId,
    family,
    version,
    rulesetId,
    createdAtISO,
    active
  }));
  return NextResponse.json(
    { source: { scope: "runtime", readOnly: true }, total: models.length, models },
    { headers: { "cache-control": "no-store" } }
  );
}
