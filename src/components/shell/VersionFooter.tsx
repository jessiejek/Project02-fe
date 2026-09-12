"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";

interface ApiVersion {
  version: string;
  pushed_at: string | null;
}

// "MM.DD.YYYY.h:mmAM/PM" in the viewer's own local time — matches how the
// user reads a timestamp on their own clock, not a fixed timezone.
function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  return `${mm}.${dd}.${d.getFullYear()}.${hours12}:${mins}${ampm}`;
}

// FE (v{commit count})({when that commit was pushed}) | BE (same, from the
// API's own version.txt). The version number only ever goes up — no
// meaning to memorize, just "is this bigger than what I saw last time."
export function VersionFooter() {
  const feVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "?";
  const feTime = process.env.NEXT_PUBLIC_BUILD_TIME;

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
      FE (v{feVersion})({feTime ? formatStamp(feTime) : "unknown"}) | BE (
      {api === null && "…"}
      {api === "unreachable" && "unreachable"}
      {api && api !== "unreachable" && (
        <>
          v{api.version})({api.pushed_at ? formatStamp(api.pushed_at) : "unknown"}
        </>
      )}
      )
    </footer>
  );
}
