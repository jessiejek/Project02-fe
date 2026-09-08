import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root to this project. Without this, Next.js infers
  // the root from the nearest lockfile and picks up a stray
  // package-lock.json in the parent CLINIC/ folder (an unrelated project),
  // which misresolves file tracing/output paths.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
