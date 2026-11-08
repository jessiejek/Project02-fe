import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:3001';
const phase = process.env.CAPTURE_PHASE || 'before';
const output = join(process.cwd(), 'test-results/doctor-appointments'); mkdirSync(output, { recursive: true });
const seed = readFileSync('../Project02-be/src/ClinicApp.Infrastructure/DevDataSeeder.cs', 'utf8');
const password = /public const string DevPassword = "([^"]+)"/.exec(seed)[1];
const browser = await chromium.launch({ headless: true, executablePath: join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') });
try {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
 const page = await context.newPage();
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto(origin + '/login'); await page.getByLabel('Email', { exact: true }).fill('doctor@clinic.test');
 await page.getByLabel('Password', { exact: true }).fill(password);
 await page.getByRole('button', { name: 'Log in', exact: true }).click();
 await page.waitForURL('**/doctor/dashboard', { timeout: 30000 });
 await page.goto(origin + '/doctor/appointments'); await page.waitForLoadState('networkidle'); await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main .animate-pulse'));
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.screenshot({ path: join(output, `${phase}-today-${width}.png`), fullPage: false });
 }
 await page.getByRole('button', { name: 'All', exact: true }).click();
 await page.locator('select').selectOption('all'); await page.waitForLoadState('networkidle'); await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && !document.querySelector('main .animate-pulse'));
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.screenshot({ path: join(output, `${phase}-history-${width}.png`), fullPage: false });
 }
 writeFileSync(join(output, `${phase}-observations.json`), JSON.stringify({ errors, text: await page.locator('main').innerText() }, null, 2));
 console.log(`Captured ${phase} real doctor appointments views: ${output}; browser errors: ${errors.length}`);
 await context.close();
} finally { await browser.close(); }
