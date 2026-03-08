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
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? ""
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
