// Public UI-only verification. No saved sessions, API fixtures, or database access.
// The Next child rejects all outbound HTTP/TCP; browser requests are local-page assets only.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const root = process.cwd();
mkdirSync(join(root, 'test-results'), { recursive: true });
const output = mkdtempSync(join(root, 'test-results/design-refresh-'));
const server = spawn(process.execPath, ['--import', join(root, 'scripts/design-offline-guard.mjs'),
  join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '0'],
  { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser;
const results = [], traffic = [];
let lastPage;
server.stdout.on('data', data => { logs += data.toString(); });
server.stderr.on('data', data => { logs += data.toString(); });
try {
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Offline Next server startup timed out')), 20_000);
    const check = () => {
      const match = logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && /Ready in/.test(logs)) { clearTimeout(timer); resolve(match[0]); }
    };
    server.stdout.on('data', check);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Offline Next server exited: ${code}`)); });
  });
  const cachedChrome = join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const executablePath = process.env.CHROME_BIN || (existsSync(cachedChrome) ? cachedChrome : chromium.executablePath());
  browser = await chromium.launch({ headless: true, executablePath });
  for (const width of [320, 390, 1440]) for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, serviceWorkers: 'block' });
    let holdRefresh = false;
    const releaseRefresh = [];
    const browserErrors = [], rejected = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || /^\/(api|dotnet-api)\//.test(url.pathname)) {
        rejected.push(url.origin + url.pathname); return route.abort();
      }
      traffic.push({ path: url.pathname, rsc: request.headers().rsc, prefetch: request.headers()['next-router-prefetch'] });
      if (holdRefresh && url.pathname === '/' && request.headers().rsc === '1') {
        await new Promise(resolve => { releaseRefresh.push(resolve); });
      }
      return route.continue();
    });
    const page = await context.newPage(); lastPage = page;
    page.on('response', response => traffic.push({ response: new URL(response.url()).pathname, status: response.status() }));
    page.on('pageerror', error => browserErrors.push(error.message));
    const response = await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await expect(page.getByRole('heading', { name: 'Get your queue number before you arrive' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Some clinic details are unavailable' })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Horizontal overflow at ${width}px`);
    const button = page.getByRole('button', { name: 'Reload clinic details' });
    holdRefresh = true;
    await Promise.all([page.waitForRequest(request => new URL(request.url()).pathname === '/' && request.headers().rsc === '1'), button.click()]);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toBeDisabled();
    if (reducedMotion === 'reduce') await expect(button.getByText('Working…')).toBeVisible();
    assert.ok(releaseRefresh.length, 'The local RSC refresh is held for pending-state verification');
    holdRefresh = false; releaseRefresh.forEach(resolve => resolve());
    await expect(button).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'Some clinic details are unavailable' })).toBeVisible();
    assert.deepEqual(browserErrors, []);
    assert.ok(rejected.every(url => url === `${origin}/dotnet-api/api/version`), 'Only the known backend-version request may be attempted; it remains aborted');
    const typography = await page.locator('h1').evaluate(el => getComputedStyle(el).textWrapStyle);
    assert.equal(typography, 'balance');
    await page.screenshot({ path: join(output, `home-${width}-${reducedMotion}.png`), fullPage: true });
    results.push({ width, reducedMotion, status: 'passed', refreshPending: true, horizontalOverflow: false, blockedApiRequests: rejected.length, browserErrors });
    await context.close();
  }
  writeFileSync(join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`Offline public UI: ${results.length}/${results.length} viewport/motion cases passed. Evidence: ${output}`);
} catch (error) {
  writeFileSync(join(output, 'failure.txt'), String(error));
  if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: join(output, 'failure.png'), fullPage: true });
  console.error(error); console.error(`Evidence: ${output}`); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  writeFileSync(join(output, 'server.log'), logs);
  writeFileSync(join(output, 'traffic.json'), JSON.stringify(traffic, null, 2));
  if (server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 5_000);
    await stopped; clearTimeout(timer);
  }
}
