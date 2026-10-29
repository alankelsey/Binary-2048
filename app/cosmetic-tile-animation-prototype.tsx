import type { CSSProperties } from "react";

export type CosmeticAnimationTreatment = "brass-glint" | "jewel-sheen" | "wildcard-orbit";

export function CosmeticTileAnimationPrototype({
  treatment,
  label = "2048"
}: {
  treatment: CosmeticAnimationTreatment;
  label?: string;
}) {
  const glyph = treatment === "wildcard-orbit" ? "✦" : label;
  return (
    <span
      className={`cosmetic-animation-prototype cosmetic-animation-${treatment}`}
      style={{ "--cosmetic-animation-order": 0 } as CSSProperties}
      aria-hidden="true"
      data-prototype-only="true"
    >
      <span className="cosmetic-animation-face">{glyph}</span>
      <span className="cosmetic-animation-effect" />
    </span>
  );
}
