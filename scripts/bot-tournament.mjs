#!/usr/bin/env node

const BASE = process.env.BASE ?? "http://localhost:3000";
const SEEDS = Number(process.env.SEEDS ?? "3");
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "250");

const ACTION_SPACE = ["U", "L", "R", "D"];

const BOTS = {
  priority: {
    pick(legalActions) {
      for (const action of ACTION_SPACE) {
        if (legalActions.includes(action)) return action;
      }
      return legalActions[0] ?? null;
    }
  },
  random: {
    pick(legalActions, ctx) {
      if (!legalActions.length) return null;
      const idx = Math.floor(ctx.rand() * legalActions.length);
      return legalActions[idx] ?? null;
    }
  },
  alternate: {
    pick(legalActions, ctx) {
      if (!legalActions.length) return null;
      const preferred = ctx.lastAction === "L" ? "R" : "L";
      if (legalActions.includes(preferred)) return preferred;
      for (const action of ["U", "D", "L", "R"]) {
        if (legalActions.includes(action)) return action;
      }
      return legalActions[0] ?? null;
    }
  }
};

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function requestJson(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 240)}`);
  }
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new Error(`${path} failed: ${message}`);
  }
  return json;
}

async function runBotOnSeed(botName, seed) {
  const created = await requestJson("/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config: { seed } })
  });
  const id = created?.id;
  if (!id) throw new Error(`Missing game id for bot ${botName}, seed ${seed}`);

  let moves = 0;
  let done = false;
  const ctx = {
    rand: mulberry32(seed + botName.length * 97),
    lastAction: null
  };

  while (!done && moves < MAX_MOVES) {
    const encoded = await requestJson(`/api/games/${id}/encoded`);
    const legalActions = Array.isArray(encoded?.legalActions) ? encoded.legalActions : [];
    const bot = BOTS[botName];
    const action = bot.pick(legalActions, ctx);
    if (!action) break;
    const expectStateHash = typeof encoded?.stateHash === "string" ? encoded.stateHash : undefined;

    const move = await requestJson(`/api/games/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, expectStateHash })
    });
    ctx.lastAction = action;
    moves += 1;
    done = Boolean(move?.done);
  }

  const finalState = await requestJson(`/api/games/${id}`);
  return {
    bot: botName,
    seed,
    score: Number(finalState?.current?.score ?? 0),
    moves: Number(finalState?.current?.turn ?? moves),
    won: Boolean(finalState?.current?.won),
    over: Boolean(finalState?.current?.over)
  };
}

async function main() {
  const botNames = Object.keys(BOTS);
  const seedValues = Array.from({ length: SEEDS }, (_, i) => 100 + i);
  const runs = [];

  for (const seed of seedValues) {
    for (const botName of botNames) {
      const result = await runBotOnSeed(botName, seed);
      runs.push(result);
    }
  }

  const summary = botNames.map((bot) => {
    const subset = runs.filter((run) => run.bot === bot);
    const totalScore = subset.reduce((sum, run) => sum + run.score, 0);
    const totalMoves = subset.reduce((sum, run) => sum + run.moves, 0);
    const wins = subset.filter((run) => run.won).length;
    return {
      bot,
      games: subset.length,
      avgScore: Math.round(totalScore / Math.max(1, subset.length)),
      avgMoves: Math.round(totalMoves / Math.max(1, subset.length)),
      wins
    };
  });

  summary.sort((a, b) => b.avgScore - a.avgScore);
  console.log(
    JSON.stringify(
      {
        base: BASE,
        seeds: seedValues,
        maxMoves: MAX_MOVES,
        ranking: summary,
        runs
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[bot:tourney] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
