"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";

interface ApiVersion {
  commit: string;
  environment: string;
  db_connected: boolean;
  db_migration: string | null;
}

// "20260911131216_Phase95FixEarningsViewCollectedAmount" -> "Phase95FixEarningsViewCollectedAmount"
// — the timestamp prefix is what makes it sortable, not what makes it readable.
function migrationLabel(id: string): string {
  const i = id.indexOf("_");
  return i === -1 ? id : id.slice(i + 1);
}

// Answers "did the deploy actually go out" without guessing — the frontend's
// own commit short-SHA is baked in at build time (next.config.ts); the
// backend + database side of that same question can only be answered by
// asking the API right now (GET /api/version, anonymous, no DB write), so
// that part loads in after mount instead of at build time.
export function VersionFooter() {
  const feSha = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const feEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME;
  const built = builtAt
    ? new Date(builtAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
    : "unknown";

  const [api, setApi] = useState<ApiVersion | "unreachable" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/version`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: ApiVersion) => {
        if (!cancelled) setApi(data);
      })
      .catch(() => {
        if (!cancelled) setApi("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="shrink-0 px-md py-sm text-center text-label-sm text-on-surface-variant/60">
      web v{feSha}
      {feEnv !== "production" && ` (${feEnv})`} · built {built}
      {" · "}
      {api === null && "api …"}
      {api === "unreachable" && <span className="text-error/80">api unreachable</span>}
      {api && api !== "unreachable" && (
        <>
          api {api.commit === "unknown" ? "v?" : `v${api.commit}`}
          {" · db "}
          {api.db_connected ? (
            <span>connected{api.db_migration && ` (${migrationLabel(api.db_migration)})`}</span>
          ) : (
            <span className="text-error/80">unreachable</span>
          )}
        </>
      )}
    </footer>
  );
}
