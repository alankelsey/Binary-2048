import { readFileSync } from "fs";
import { join } from "path";

function readGlobalCss(): string {
  return readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
}

describe("mobile layout css guardrails", () => {
  it("keeps expected mobile breakpoints", () => {
    const css = readGlobalCss();
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (max-width: 420px)");
  });

  it("keeps responsive board sizing rules", () => {
    const css = readGlobalCss();
    expect(css).toContain(".board {\n    width: min(100%, 86vw);");
    expect(css).toContain(".board {\n    width: min(100%, 92vw);");
    expect(css).toContain(".board {\n    width: min(100%, 94vw);");
  });

  it("keeps mobile control stacking and scrubber behavior", () => {
    const css = readGlobalCss();
    expect(css).toContain(".actions > button {\n    flex: 1 1 calc(50% - 0.2rem);");
    expect(css).toContain(".actions > button,\n  .options-grid button {\n    flex: 1 1 100%;");
    expect(css).toContain(".replay-scrubber-wrap {\n    width: 100%;");
    expect(css).toContain(".replay-scrubber-wrap input[type=\"range\"] {\n    flex: 1 1 auto;");
  });
});
