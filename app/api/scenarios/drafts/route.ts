import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isScenarioDraft } from "@/lib/binary2048/scenario-draft";
import { deleteScenarioDraft, listScenarioDrafts, saveScenarioDraft } from "@/lib/binary2048/scenario-draft-store";
import { getRequiredServerSession, ServerSessionLookupError } from "@/lib/binary2048/server-session";

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  const ownerId = await authenticatedOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;
  try {
    return NextResponse.json({ drafts: await listScenarioDrafts(ownerId) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Scenario draft storage is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  const ownerId = await authenticatedOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;
  const body = await req.json().catch(() => null);
  if (!isScenarioDraft(body)) {
    return NextResponse.json({ error: "Valid versioned scenario draft required" }, { status: 400, headers: NO_STORE });
  }
  try {
    return NextResponse.json({ draft: await saveScenarioDraft(ownerId, body) }, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Scenario draft storage is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export async function DELETE(req: Request) {
  const ownerId = await authenticatedOwnerId();
  if (ownerId instanceof NextResponse) return ownerId;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
    return NextResponse.json({ error: "Valid draft ID required" }, { status: 400, headers: NO_STORE });
  }
  try {
    const deleted = await deleteScenarioDraft(ownerId, id);
    return deleted
      ? NextResponse.json({ deleted: true }, { headers: NO_STORE })
      : NextResponse.json({ error: "Scenario draft not found" }, { status: 404, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Scenario draft storage is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}

async function authenticatedOwnerId(): Promise<string | NextResponse> {
  try {
    const session = await getRequiredServerSession("scenario-drafts");
    const identity = session?.user?.email || session?.user?.name;
    if (!identity) return NextResponse.json({ error: "Authenticated session required" }, { status: 401, headers: NO_STORE });
    return createHash("sha256").update(`binary2048-scenario-owner:${identity}`).digest("hex");
  } catch (error) {
    if (error instanceof ServerSessionLookupError) {
      return NextResponse.json({ error: "Authentication service temporarily unavailable" }, { status: 503, headers: NO_STORE });
    }
    throw error;
  }
}
