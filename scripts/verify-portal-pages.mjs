// Read-only local UI verification for the public, admin, staff and patient portals.
// Normal login against the LOCAL dev API only; every non-GET request (other than the
// session login/refresh) is blocked, so no records are created, edited or deleted.
// Usage: PORTAL=public|admin|staff|patient node scripts/verify-portal-pages.mjs
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:3001';
const api = 'http://127.0.0.1:5055';
const portal = process.env.PORTAL || 'public';
const phase = process.env.CAPTURE_PHASE || 'after';
const output = join(process.cwd(), 'test-results/portal-pass', portal); mkdirSync(output, { recursive: true });
const seed = readFileSync('../Project02-be/src/ClinicApp.Infrastructure/DevDataSeeder.cs', 'utf8');
const password = /public const string DevPassword = "([^"]+)"/.exec(seed)[1];
const browser = await chromium.launch({ headless: true, executablePath: join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') });
const results = [], blocked = [], errors = [];
const list = body => Array.isArray(body) ? body : (body?.items ?? body?.data ?? []);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && url.pathname !== '/__nextjs_original-stack-frames' && !/\/api\/(session\/(login|refresh)|auth\/(login|refresh))|\/hubs\//.test(url.pathname)) {
      blocked.push({ method: req.method(), path: url.pathname }); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  let routes = [];
  if (portal === 'public') {
    routes = [['home', '/'], ['login', '/login'], ['register', '/register'], ['forgot-password', '/forgot-password']];
  } else {
    await page.goto(origin + '/login');
    await page.getByLabel('Email', { exact: true }).fill(`${portal}@clinic.test`);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForURL(`**/${portal}/dashboard`, { timeout: 30000 });
    const { token } = await (await context.request.get(origin + '/api/session/token')).json(); assert.ok(token);
    const get = async path => { const r = await context.request.get(api + path, { headers: { Authorization: `Bearer ${token}` } }); return r.ok() ? r.json() : null; };
    if (portal === 'admin' || portal === 'staff') {
      const bookings = list(await get('/api/bookings'));
      const patients = list(await get('/api/patients'));
      const b = bookings.find(x => x.status === 'Completed') || bookings[0];
      const p = patients[0];
      routes = portal === 'admin'
        ? [['dashboard', '/admin/dashboard'], ['bookings', '/admin/bookings'], ['calendar', '/admin/calendar'], ['walk-in', '/admin/walk-in'],
           ['patients', '/admin/patients'], ['doctors', '/admin/doctors'], ['doctors-new', '/admin/doctors/new'], ['staff', '/admin/staff'],
           ['announcements', '/admin/announcements'], ['audit-logs', '/admin/audit-logs'], ['reports', '/admin/reports'], ['settings', '/admin/settings']]
        : [['dashboard', '/staff/dashboard'], ['queue', '/staff/queue'], ['walk-in', '/staff/walk-in'], ['bookings', '/staff/bookings'],
           ['patients', '/staff/patients'], ['payments', '/staff/payments'], ['doctor-status', '/staff/doctor-status'],
           ['announcements', '/staff/announcements'], ['profile', '/staff/profile']];
      if (b) routes.push(['booking-detail', `/${portal}/bookings/${b.booking_id ?? b.id}`]);
      if (p) routes.push(['patient-detail', `/${portal}/patients/${p.patient_id ?? p.id}`]);
      if (portal === 'admin') {
        const doctors = list(await get('/api/doctors'));
        const d = doctors[0]; if (d) routes.push(['doctor-edit', `/admin/doctors/${d.doctor_id ?? d.staff_id ?? d.id}/edit`]);
      }
    } else if (portal === 'patient') {
      const mine = list(await get('/api/bookings/me'));
      const doctors = list(await get('/api/doctors'));
      routes = [['dashboard', '/patient/dashboard'], ['bookings', '/patient/bookings'], ['doctors', '/patient/doctors'],
        ['medical-records', '/patient/medical-records'], ['prescriptions', '/patient/prescriptions'], ['lab-results', '/patient/lab-results'],
        ['vaccinations', '/patient/vaccinations'], ['documents', '/patient/documents'], ['privacy-consent', '/patient/privacy-consent'], ['profile', '/patient/profile']];
      const b = mine.find(x => x.status === 'Completed') || mine[0];
      if (b) { routes.push(['booking-detail', `/patient/bookings/${b.booking_id ?? b.id}`]); routes.push(['review', `/patient/reviews/${b.booking_id ?? b.id}`]); }
      const d = doctors[0]; if (d) routes.push(['doctor-detail', `/patient/doctors/${d.doctor_id ?? d.staff_id ?? d.id}`]);
    }
  }
  for (const [name, path] of routes) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto(origin + path);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForFunction(() => { const m = document.querySelector('main') || document.body; return !/^Loading[^\n]*[….]?$/.test(m.innerText.trim()) && !m.querySelector('.animate-pulse'); }, {}, { timeout: 20000 }).catch(() => {});
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const nested = await page.locator('a button, button a, a a').count();
      const h1 = await page.locator('h1').first().innerText().catch(() => '');
      await page.screenshot({ path: join(output, `${phase}-${name}-${width}.png`), fullPage: false });
      results.push({ name, path, width, http: response?.status(), overflow, nested, h1 });
    }
  }
} finally { await browser.close(); }
writeFileSync(join(output, `${phase}-results.json`), JSON.stringify({ results, blocked, errors }, null, 1));
for (const r of results) console.log(`${r.http} ${r.width}px ${r.overflow ? 'OVERFLOW' : 'ok'} nested=${r.nested} ${r.path} — ${r.h1}`);
console.log('blocked writes:', blocked.length, 'page errors:', errors.length, errors.slice(0, 5));
