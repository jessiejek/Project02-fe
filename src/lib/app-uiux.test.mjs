//JJQR - AI (Nov 19, 2026) - unit tests for the app-wide UI/UX fixes (availability unknown state, Settings merge, version footer, search placeholder)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('dashboard: availability is unknown (null) until it loads; failure shows a Retry, never a set status', () => {
  const src = read('app/doctor/dashboard/page.tsx');
  assert.match(src, /useState<DayStatus \| null>\(null\)/);
  assert.match(src, /setDayStatus\(null\)/);
  assert.match(src, /data-testid="availability-unknown"/);
  assert.match(src, /roleBadge=\{dayStatus \? <StatusPill status=\{dayStatus\} \/> : undefined\}/);
});

test('doctor Settings: no sidebar link, page redirects to Profile', () => {
  assert.doesNotMatch(read('lib/nav-config.ts').split('admin: {')[0], /\/doctor\/settings/);
  assert.match(read('app/doctor/settings/page.tsx'), /redirect\("\/doctor\/profile"\)/);
});

test('version footer is hidden in production unless forced on', () => {
  const src = read('components/shell/VersionFooter.tsx');
  assert.match(src, /shouldShowVersionFooter\(process\.env\.NODE_ENV, process\.env\.NEXT_PUBLIC_SHOW_VERSION\)/);
  assert.match(src, /nodeEnv !== "production" \|\| forceShow === "true"/);
});

test('header search placeholder is short', () => {
  assert.match(read('components/shell/Topbar.tsx'), /placeholder="Search…"/);
});
