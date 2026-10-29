import { CosmeticTileAnimationPrototype } from "@/app/cosmetic-tile-animation-prototype";
import Image from "next/image";

type VisionMode = "default" | "deuteranopia" | "protanopia" | "tritanopia";

const TILES = [
  { kind: "number", token: "2048", cue: "number tile" },
  { kind: "zero", token: "0", cue: "zero: ring cue" },
  { kind: "wildcard", token: "WILD", cue: "wildcard: star cue" },
  { kind: "lock", token: "LOCK 0", cue: "locked zero: lock cue" }
] as const;

export function CosmeticAssetProof({
  scheme = "dark",
  visionMode = "default"
}: {
  scheme?: "light" | "dark";
  visionMode?: VisionMode;
}) {
  return (
    <section
      className="cosmetic-asset-proof"
      data-scheme={scheme}
      data-vision-mode={visionMode}
      data-prototype-only="true"
      aria-label="Workbench cosmetic asset proof"
    >
      <figure className="cosmetic-proof-board">
        {/* The raster is decorative; deterministic game markup would own all cell semantics. */}
        <Image
          src="/themes/workbench-proof-v1/board.jpg"
          alt=""
          aria-hidden="true"
          width={1024}
          height={1024}
          unoptimized
        />
        <figcaption>Orthographic wood, brass, and felt board</figcaption>
      </figure>

      <div className="cosmetic-proof-tile-list" role="list" aria-label="Jewel tile compatibility samples">
        {TILES.map((tile, index) => (
          <div
            className={`cosmetic-proof-tile cosmetic-proof-tile-${index}`}
            role="listitem"
            aria-label={tile.cue}
            key={tile.kind}
          >
            <span className="cosmetic-proof-token">{tile.token}</span>
          </div>
        ))}
      </div>

      <div className="cosmetic-proof-motion">
        <CosmeticTileAnimationPrototype treatment="jewel-sheen" label="2048" />
        <span>Animated jewel sheen; static under reduced motion</span>
      </div>
    </section>
  );
}
