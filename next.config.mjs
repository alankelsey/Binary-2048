import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid flaky local cache artifacts that can cause missing chunk/module errors.
      config.cache = false;
    }
    return config;
  }
};

export default nextConfig;
