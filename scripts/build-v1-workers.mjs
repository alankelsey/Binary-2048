import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const out = process.env.WORKER_BUILD_DIR ?? "/tmp/binary2048-v1-workers";
mkdirSync(out, { recursive: true });
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
await build({ entryPoints: { index: "workers/index.ts", telemetry: "workers/telemetry.ts" }, outdir: out, bundle: true, platform: "node", format: "cjs", target: "node22", tsconfig: "tsconfig.json", define: { "process.env.NEXT_PUBLIC_APP_COMMIT": JSON.stringify(commit) } });
console.log(`Worker bundles built: ${out}`);
