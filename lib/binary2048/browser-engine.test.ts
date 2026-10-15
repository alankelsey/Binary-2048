import { build } from "esbuild";

import {
  BROWSER_ENGINE_PROTOCOL_VERSION,
  BROWSER_ENGINE_RULESET_ID,
  projectBrowserMove
} from "@/lib/binary2048/browser-engine";
import { applyMove, createGame } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

const directions: Dir[] = ["left", "down", "right", "up", "left", "up", "right", "down"];

function project(state: GameState, direction: Dir) {
  return projectBrowserMove({
    protocolVersion: BROWSER_ENGINE_PROTOCOL_VERSION,
    rulesetId: BROWSER_ENGINE_RULESET_ID,
    state,
    direction
  });
}

describe("browser engine boundary", () => {
  test.each([17, 42, 90210, 2147483647])(
    "matches the canonical engine step-for-step for seed %i",
    (seed) => {
      let state = createGame({ seed }).state;

      for (const direction of [...directions, ...directions, ...directions]) {
        const direct = applyMove(state, direction);
        const browser = project(state, direction);

        expect({ state: browser.state, moved: browser.moved, events: browser.events }).toEqual(direct);
        expect(browser.baseTurn).toBe(state.turn);
        state = direct.state;
      }
    }
  );

  it("preserves parity for special tiles and no-op or terminal boundaries", () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, { t: "z" }, { t: "n", v: 4 }],
      [{ t: "w", m: 2 }, { t: "n", v: 2 }, { t: "i" }, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const initial = createGame({ seed: 73 }, grid).state;

    for (const direction of directions) {
      const direct = applyMove(initial, direction);
      const browser = project(initial, direction);
      expect({ state: browser.state, moved: browser.moved, events: browser.events }).toEqual(direct);
    }

    const terminal = { ...initial, over: true };
    const direct = applyMove(terminal, "left");
    const browser = project(terminal, "left");
    expect({ state: browser.state, moved: browser.moved, events: browser.events }).toEqual(direct);
    expect(browser.state).not.toBe(terminal);
  });

  it("does not mutate or share mutable references with its input", () => {
    const state = createGame({ seed: 99 }).state;
    const snapshot = structuredClone(state);
    const result = project(state, "left");

    expect(state).toEqual(snapshot);
    expect(result.state).not.toBe(state);
    expect(result.state.config).not.toBe(state.config);
    expect(result.state.config.spawn.wildcardMultipliers).not.toBe(state.config.spawn.wildcardMultipliers);
    expect(result.state.grid).not.toBe(state.grid);
  });

  it("fails closed for incompatible versions", () => {
    const state = createGame({ seed: 12 }).state;
    expect(() =>
      projectBrowserMove({
        protocolVersion: 2 as typeof BROWSER_ENGINE_PROTOCOL_VERSION,
        rulesetId: BROWSER_ENGINE_RULESET_ID,
        state,
        direction: "left"
      })
    ).toThrow("Unsupported browser engine protocol: 2");
    expect(() =>
      projectBrowserMove({
        protocolVersion: BROWSER_ENGINE_PROTOCOL_VERSION,
        rulesetId: "future-rules" as typeof BROWSER_ENGINE_RULESET_ID,
        state,
        direction: "left"
      })
    ).toThrow("Unsupported browser engine ruleset: future-rules");
  });

  it("bundles as browser ESM without Node dependencies and stays below 24 KiB", async () => {
    const bundle = await build({
      absWorkingDir: process.cwd(),
      entryPoints: ["lib/binary2048/browser-engine.ts"],
      bundle: true,
      format: "esm",
      platform: "browser",
      minify: true,
      metafile: true,
      write: false
    });
    const bytes = bundle.outputFiles.reduce((total, file) => total + file.contents.byteLength, 0);
    const inputs = Object.keys(bundle.metafile?.inputs ?? {});

    expect(bytes).toBeLessThanOrEqual(24 * 1024);
    expect(inputs).toEqual(
      expect.arrayContaining(["lib/binary2048/browser-engine.ts", "lib/binary2048/engine.ts"])
    );
    expect(inputs.some((input) => input.startsWith("node:") || input.includes("node_modules"))).toBe(false);
  });
});
