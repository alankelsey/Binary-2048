import assert from "node:assert/strict";
import test from "node:test";
import { buildMovePrompt, formatEncodedBoard, parseOllamaAction } from "./ollama-bot-lib.mjs";

test("formats encoded special and number tiles", () => {
  assert.deepEqual(
    formatEncodedBoard([[{ type: 0, value: 0 }, { type: 1, value: 0 }, { type: 2, value: 3 }, { type: 3, value: 1 }, { type: 4, value: 0 }]]),
    [[".", "Z", "8", "W2", "L0"]]
  );
});

test("accepts only a legal structured action", () => {
  assert.deepEqual(parseOllamaAction('{"action":"l"}', ["L", "R"]), { action: "L", fallback: false });
  assert.deepEqual(parseOllamaAction('{"action":"U"}', ["L", "R"]), { action: "L", fallback: true });
});

test("prompt includes the board and legal action constraint", () => {
  const prompt = buildMovePrompt([[{ type: 2, value: 1 }]], ["L"], [{
    action: "L",
    encodedState: [[{ type: 2, value: 2 }]],
    scoreDelta: 4,
    emptyCells: 12,
    maxTile: 4,
    mergeCount: 1,
    won: false,
    over: false
  }]);
  assert.match(prompt, /Board: \[\["2"\]\]/);
  assert.match(prompt, /Legal actions: \["L"\]/);
  assert.match(prompt, /resultingBoard/);
  assert.match(prompt, /scoreDelta/);
});
