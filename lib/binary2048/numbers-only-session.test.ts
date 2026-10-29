import {
  createSession,
  exportRecoverySnapshot,
  exportSession,
  getSession,
  importSession,
  moveSession
} from "@/lib/binary2048/sessions";
import { createNumbersOnlyConfig, NUMBERS_ONLY_RULESET_ID } from "@/lib/binary2048/numbers-only";

describe("numbers-only session serialization", () => {
  it("preserves explicit identity through export, deterministic replay import, and recovery export", async () => {
    const config = createNumbersOnlyConfig(12_101, { width: 2, height: 2, winTile: 16 });
    const original = await createSession(
      config,
      [[{ t: "n", v: 1 }, { t: "n", v: 1 }], [null, null]],
      { gameMode: "numbers-only", modeRulesetId: NUMBERS_ONLY_RULESET_ID }
    );
    await moveSession(original.current.id, "left");
    const latest = (await getSession(original.current.id))!;
    const exported = (await exportSession(original.current.id))!;
    const snapshot = (await exportRecoverySnapshot(original.current.id))!;
    const imported = await importSession(JSON.parse(JSON.stringify(exported)));

    expect(exported.meta.integrity).toMatchObject({
      gameMode: "numbers-only",
      modeRulesetId: NUMBERS_ONLY_RULESET_ID
    });
    expect(snapshot.integrity).toMatchObject(exported.meta.integrity);
    expect(imported.integrity).toMatchObject({
      sessionClass: "unranked",
      source: "imported",
      gameMode: "numbers-only",
      modeRulesetId: NUMBERS_ONLY_RULESET_ID
    });
    expect(imported.current).toMatchObject({
      grid: latest.current.grid,
      score: latest.current.score,
      turn: latest.current.turn,
      won: latest.current.won,
      over: latest.current.over
    });
  });

  it("rejects an export that claims numbers-only identity with special-tile state", async () => {
    const config = createNumbersOnlyConfig(12_102, { width: 2, height: 2 });
    const session = await createSession(config, [[{ t: "n", v: 1 }, null], [null, null]], {
      gameMode: "numbers-only",
      modeRulesetId: NUMBERS_ONLY_RULESET_ID
    });
    const exported = (await exportSession(session.current.id))!;
    exported.initial.grid[0][0] = { t: "w", m: 2 };

    await expect(importSession(exported)).rejects.toThrow("does not allow special");
  });
});
