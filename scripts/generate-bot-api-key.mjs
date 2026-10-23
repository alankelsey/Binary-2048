import { createHash, randomBytes } from "node:crypto";

const id = process.argv[2];
if (!id || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id)) {
  console.error("Usage: npm run bot:key:generate -- <bot-id>");
  process.exit(1);
}
const scopes = process.argv[3] ?? "simulation:run|tournament:run|training:read|replay:ingest|jobs:read";
const allowedScopes = new Set(["simulation:run", "tournament:run", "training:read", "replay:ingest", "jobs:read", "research:*"]);
if (!scopes.split("|").every((scope) => allowedScopes.has(scope))) {
  console.error("Scopes must be pipe-separated research scopes or research:*");
  process.exit(1);
}

const key = `b2048_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(key).digest("hex");

console.log(`Bot ID: ${id}`);
console.log(`API key (show once): ${key}`);
console.log(`Config entry: ${id}=${hash}`);
console.log(`Scope entry: ${id}=${scopes}`);
console.log("Append the entries to BINARY2048_BOT_API_KEY_HASHES and BINARY2048_BOT_API_KEY_SCOPES, then deliver the API key securely.");
