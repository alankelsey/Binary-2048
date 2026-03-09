import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
const commitSha =
  process.env.AWS_COMMIT_ID?.slice(0, 7) ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.GIT_COMMIT?.slice(0, 7) ??
  "dev";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: String(packageJson.version ?? "0.1.0"),
    NEXT_PUBLIC_APP_COMMIT: commitSha,
    // Amplify WEB_COMPUTE does not forward SSM-sourced env vars to the SSR
    // Lambda runtime, so we bake auth secrets into the server bundle here.
    AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "",
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID ?? "",
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET ?? "",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
    BINARY2048_ADMIN_TOKEN: process.env.BINARY2048_ADMIN_TOKEN ?? "",
    BINARY2048_RUN_STORE: process.env.BINARY2048_RUN_STORE ?? "memory",
    BINARY2048_SESSION_STORE: process.env.BINARY2048_SESSION_STORE ?? process.env.BINARY2048_RUN_STORE ?? "memory",
    BINARY2048_MONGO_URI: process.env.BINARY2048_MONGO_URI ?? "",
    BINARY2048_MONGO_DB: process.env.BINARY2048_MONGO_DB ?? "binary2048",
    BINARY2048_MONGO_RUN_COLLECTION: process.env.BINARY2048_MONGO_RUN_COLLECTION ?? "runs",
    BINARY2048_MONGO_SESSION_COLLECTION: process.env.BINARY2048_MONGO_SESSION_COLLECTION ?? "sessions",
    BINARY2048_REPLAY_ARTIFACT_STORE: process.env.BINARY2048_REPLAY_ARTIFACT_STORE ?? "inline",
    BINARY2048_REPLAY_S3_BUCKET: process.env.BINARY2048_REPLAY_S3_BUCKET ?? "",
    BINARY2048_REPLAY_S3_REGION: process.env.BINARY2048_REPLAY_S3_REGION ?? process.env.AWS_REGION ?? "us-east-2",
    BINARY2048_REPLAY_S3_PREFIX: process.env.BINARY2048_REPLAY_S3_PREFIX ?? "replays",
    BINARY2048_REPLAY_S3_MIN_SCORE: process.env.BINARY2048_REPLAY_S3_MIN_SCORE ?? "2048",
    BINARY2048_REPLAY_S3_CONTEST_ONLY: process.env.BINARY2048_REPLAY_S3_CONTEST_ONLY ?? "false"
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid flaky local cache artifacts that can cause missing chunk/module errors.
      config.cache = false;
    }
    return config;
  }
};

export default nextConfig;
