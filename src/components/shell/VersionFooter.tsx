// Answers "did the deploy actually go out" without guessing — the commit
// short-SHA and env are baked in at build time (next.config.ts), so a stale
// tab or a deploy that silently failed shows its age right on the page.
export function VersionFooter() {
  const sha = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const env = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME;
  const built = builtAt
    ? new Date(builtAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
    : "unknown";

  return (
    <footer className="shrink-0 px-md py-sm text-center text-label-sm text-on-surface-variant/60">
      v{sha}
      {env !== "production" && ` · ${env}`} · built {built}
    </footer>
  );
}
