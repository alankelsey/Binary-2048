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
    expect(css).toContain(".actions {\n  display: flex;");
    expect(css).toContain("margin-top: 0.9rem;");
    expect(css).toContain(".mobile-controls-toggle {\n  display: inline-flex;");
    expect(css).toContain(".actions {\n    gap: 0.34rem;\n    margin-top: 1.1rem;");
    expect(css).toContain(".actions.mobile-collapsed {\n    display: none;");
    expect(css).toContain(".actions-primary {\n    position: fixed;");
    expect(css).toContain(".actions-primary > button {\n    flex: 1 1 0;\n    min-height: 2.75rem;");
    expect(css).toContain(".actions > button {\n    flex: 1 1 calc(50% - 0.2rem);");
    expect(css).toContain(".actions-secondary > button,\n  .options-grid button {\n    flex: 1 1 100%;");
    expect(css).toContain(".replay-scrubber-wrap {\n    width: 100%;");
    expect(css).toContain(".replay-scrubber-wrap input[type=\"range\"] {\n    flex: 1 1 auto;");
  });

  it("keeps the fixed dock clear of iPhone-style safe areas", () => {
    const css = readGlobalCss();
    // Headless browsers report a 0px inset here regardless (no notch/home
    // indicator to emulate), so this is a structural guard that the rule
    // stays in place, not a substitute for a real-device check.
    expect(css).toContain("padding: 0.5rem 0.6rem calc(0.5rem + env(safe-area-inset-bottom, 0px));");
    expect(css).toContain("main {\n    padding: 0.85rem 0.55rem 1rem;\n    padding-bottom: calc(4.9rem + env(safe-area-inset-bottom, 0px));");
  });

  it("keeps the armed New Game confirm button from wrapping or truncating in the dock", () => {
    const css = readGlobalCss();
    expect(css).toContain(".actions-primary > button.danger-armed {\n    flex-grow: 1.9;\n  }");
    expect(css).toContain("white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    min-width: 0;");
  });
});
