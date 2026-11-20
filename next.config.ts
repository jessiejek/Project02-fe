import path from "node:path";
import { execSync } from "node:child_process";
import type { NextConfig } from "next";
//JJQR - AI (Nov 14, 2026)
import { withSerwist } from "@serwist/turbopack";
//JJQR - END

// An auto-incrementing "version number" (total commit count) instead of a
// hash — goes up by one every commit, no manual bumping, no meaning to
// remember. Paired with that same commit's own timestamp ("the time that
// version was pushed"), not the build wall-clock, so it stays correct
// regardless of how long a build/deploy takes to actually run.
function commitCount(): string {
  try {
    return execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    return "?";
  }
}
function commitTimeIso(): string {
  try {
    return execSync("git log -1 --format=%cI").toString().trim();
  } catch {
    return new Date().toISOString();
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
    NEXT_PUBLIC_APP_VERSION: commitCount(),
    NEXT_PUBLIC_BUILD_TIME: commitTimeIso(),
  },
  //JJQR - AI (Nov 14, 2026)
  async rewrites() {
    return [
      { source: "/sw.js", destination: "/serwist/sw.js" },
      { source: "/sw.js.map", destination: "/serwist/sw.js.map" },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/serwist/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
  //JJQR - END
};

//JJQR - AI (Nov 14, 2026)
export default withSerwist(nextConfig);
//JJQR - END
