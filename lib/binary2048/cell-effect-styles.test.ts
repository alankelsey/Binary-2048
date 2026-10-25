import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function ruleBlock(marker: string, fromIndex = 0): string {
  const start = css.indexOf(marker, fromIndex);
  if (start < 0) throw new Error(`Missing CSS marker ${marker}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    if (depth === 0) return css.slice(start, index + 1);
  }
  throw new Error(`Unclosed CSS block ${marker}`);
}

describe("cell effect CSS performance guardrails", () => {
  it.each(["mergeNumber", "mergeWild", "zeroBust", "spawnPulse"])(
    "keeps %s free of repainting animation properties",
    (name) => {
      const keyframes = ruleBlock(`@keyframes ${name}`);
      expect(keyframes).not.toMatch(/\b(?:box-shadow|filter|border-color)\s*:/);
      expect(keyframes).toMatch(/transform\s*:/);
    }
  );

  it("limits transient effect promotion to transform and opacity", () => {
    for (const selector of [".cell.fx-merge-number", ".cell.fx-merge-wild", ".cell.fx-zero-bust", ".cell.fx-spawn"]) {
      expect(ruleBlock(selector)).toContain("will-change: transform, opacity;");
    }
  });

  it("preserves the reduced-motion collapse for every transient effect", () => {
    const reducedMotion = ruleBlock("@media (prefers-reduced-motion: reduce)", css.indexOf("@keyframes spawnPulse"));
    expect(reducedMotion).toContain(".cell.fx-merge-number");
    expect(reducedMotion).toContain(".cell.fx-merge-wild");
    expect(reducedMotion).toContain(".cell.fx-zero-bust");
    expect(reducedMotion).toContain(".cell.fx-spawn");
    expect(reducedMotion).toContain("animation-duration: 1ms;");
  });
});
