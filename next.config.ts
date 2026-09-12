import path from "node:path";
import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Vercel sets these at build time (not client-exposed by default — every
// var here has to be forwarded explicitly via `env` below). Falls back to
// reading git directly for local dev, where those aren't set at all.
function commitSha(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  // Pins the workspace root to this project. Without this, Next.js infers
  // the root from the nearest lockfile and picks up a stray
  // package-lock.json in the parent CLINIC/ folder (an unrelated project),
  // which misresolves file tracing/output paths.
  turbopack: {
    root: path.join(__dirname),
  },
  // Surfaced by <VersionFooter> so "did the deploy actually go out" is a
  // glance at the page instead of a guess.
  env: {
    NEXT_PUBLIC_APP_VERSION: commitSha(),
    NEXT_PUBLIC_APP_ENV: process.env.VERCEL_ENV ?? "development",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
