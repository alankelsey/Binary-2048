import { NextResponse } from "next/server";
import { encodeState, legalMoves } from "@/lib/binary2048/ai";
import { getSession } from "@/lib/binary2048/sessions";

const RULESET_ID = "binary2048-v1";
const ENGINE_VERSION = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const state = session.current;
  return NextResponse.json({
    id,
    encodedState: encodeState(state),
    legalMoves: legalMoves(state),
    meta: {
      rulesetId: RULESET_ID,
      engineVersion: ENGINE_VERSION,
      width: state.width,
      height: state.height,
      spawnProbs: {
        zero: state.config.spawn.pZero,
        one: state.config.spawn.pOne,
        wildcard: state.config.spawn.pWildcard
      }
    }
  });
}
