import { createHash, randomBytes } from "node:crypto";

const id = process.argv[2];
if (!id || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id)) {
  console.error("Usage: npm run bot:key:generate -- <bot-id>");
  process.exit(1);
}

const key = `b2048_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(key).digest("hex");

console.log(`Bot ID: ${id}`);
console.log(`API key (show once): ${key}`);
console.log(`Config entry: ${id}=${hash}`);
console.log("Append the config entry to BINARY2048_BOT_API_KEY_HASHES and deliver the API key securely.");
