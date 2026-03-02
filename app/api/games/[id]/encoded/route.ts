import { NextResponse } from "next/server";
import { ACTION_SPACE, encodeState, flattenEncodedState, legalActionCodes, legalMoves, stateHash } from "@/lib/binary2048/ai";
import { getSession } from "@/lib/binary2048/sessions";

const RULESET_ID = "binary2048-v1";
const ENGINE_VERSION = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const state = session.current;
  const encodedState = encodeState(state);
  const encodedFlat = flattenEncodedState(encodedState);
  const legalDirMoves = legalMoves(state);
  const legalActions = legalActionCodes(state);
  return NextResponse.json({
    id,
    encodedState,
    encodedFlat,
    stateHash: stateHash(state),
    actionSpace: ACTION_SPACE,
    legalMoves: legalDirMoves,
    legalActions,
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
