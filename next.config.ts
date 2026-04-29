import type { NextConfig } from "next";
import path from "node:path";

// Silence baseline-browser-mapping stale data warnings during build.
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = "true";
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ["three"],
  // Required when multiple lockfiles exist (parent workspace); prevents wrong root inference
  turbopack: { root: __dirname },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "bigint-buffer": path.resolve(__dirname, "src/shims/bigint-buffer.ts"),
    };
    // WalletConnect/pino optionally requires pino-pretty; avoid resolution failure
    config.resolve.fallback = { ...config.resolve.fallback, "pino-pretty": false };
    return config;
  },
};

export default nextConfig;
