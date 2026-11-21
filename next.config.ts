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

// HTTPS + basic security headers. Production only: HSTS on plain-http
// localhost would pin browsers to https for dev.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  //JJQR - AI (Nov 21, 2026) - desktop "clinic node": an opt-in self-contained build (NEXT_OUTPUT=standalone, own folder via NEXT_DIST_DIR) so it never touches the normal build or a running dev server
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  //JJQR - END
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
      ...(process.env.NODE_ENV === "production"
        ? [{ source: "/:path*", headers: securityHeaders }]
        : []),
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
