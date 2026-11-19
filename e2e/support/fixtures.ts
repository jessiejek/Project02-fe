import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { authFile } from "./auth";
import { BE_URL, FE_URL, TAG } from "../playwright.config";
import { apiAs, type Role } from "./api";
import type { APIRequestContext } from "@playwright/test";

/**
 * Fixtures:
 *   - `as(role)`  → a fresh Page already logged in as that dev role.
 *   - `api(role)` → an APIRequestContext authed as that role (for seeding + assertions).
 *
 * `as()` opens a real second/third browser context, so one test can act as
 * staff + doctor + patient concurrently (the full-visit journey needs this).
 */
//JJQR - AI (Nov 19, 2026) - e2e-full-coverage: console/network guard, per-test data tag, per-test cleanup registry
type Allow = string | RegExp;
export interface Guard {
  /** Allow-list expected API/page errors for THIS test, e.g. guard.allow(/\/api\/payments\/.*\/confirm/) or guard.allow("400 POST /api/x"). Matched against "<status> <METHOD> <url>" and page-error text. */
  allow(...patterns: Allow[]): void;
  /** Turn the guard off for this test (use sparingly, say why in the test). */
  off(): void;
  readonly seen: string[];
}
export interface Tagger {
  /** `E2E-<runId>-<label>-<n>` — unique per call, safe to embed in names/notes/titles. */
  (label?: string): string;
  /** E2E-<runId> */
  readonly run: string;
}
export type Cleanup = (fn: () => Promise<unknown> | unknown) => void;

type Fixtures = {
  as: (role: Role) => Promise<Page>;
  /** A fresh logged-OUT page (new browser context, guard attached). */
  anon: () => Promise<Page>;
  /** A fresh page logged in through the real /login form as any account (e.g. a freshly registered patient). */
  loginAs: (email: string, password: string) => Promise<Page>;
  api: (role: Role) => Promise<APIRequestContext>;
  guard: Guard;
  tag: Tagger;
  cleanup: Cleanup;
};

let tagSeq = Math.floor(Math.random() * 1000);
const API_HOSTS = [new URL(BE_URL).origin];
const FE_ORIGIN = new URL(FE_URL).origin;
// Responses that are normal app behaviour on every page and never a bug.
const GLOBAL_ALLOW: RegExp[] = [
  /\/api\/auth\/refresh-token/,   // silent refresh probe when the cookie is gone
  /\/hubs\/clinic\//,             // SignalR negotiate/reconnect noise
  /_next\/|\.(?:png|ico|svg|woff2?|map|webmanifest)(\?|$)/, // static assets
  /\/serwist\/|\/sw\.js|\/manifest/,
];

export const test = base.extend<Fixtures>({
  guard: async ({}, use, testInfo) => {
    const allow: Allow[] = [];
    let off = false;
    const seen: string[] = [];
    const g: Guard & { _attach(page: Page): void } = {
      allow: (...p) => void allow.push(...p),
      off: () => void (off = true),
      seen,
      _attach(page: Page) {
        page.on("pageerror", (e) => seen.push(`pageerror ${String(e).split("\n")[0]}`));
        page.on("response", (res) => {
          const st = res.status();
          if (st < 400) return;
          const url = res.url();
          const isApi = API_HOSTS.some((h) => url.startsWith(h)) || url.startsWith(`${FE_ORIGIN}/api/`);
          const isDoc = res.request().resourceType() === "document" && st >= 500;
          if (!isApi && !isDoc) return;
          seen.push(`${st} ${res.request().method()} ${url.replace(FE_ORIGIN, "").replace(API_HOSTS[0], "")}`);
        });
      },
    };
    await use(g);
    // Only judge tests that are supposed to pass and haven't already failed.
    if (off || testInfo.expectedStatus !== "passed" || testInfo.status !== testInfo.expectedStatus) return;
    const matches = (line: string, p: Allow) => (typeof p === "string" ? line.includes(p) : p.test(line));
    const bad = seen.filter((l) => !GLOBAL_ALLOW.some((p) => p.test(l)) && !allow.some((p) => matches(l, p)));
    expect(bad, `Unexpected page errors / API 4xx-5xx (allow-list with guard.allow()):\n${bad.join("\n")}`).toEqual([]);
  },

  tag: async ({}, use) => {
    const t = ((label = "t") => `${TAG}-${label}-${(++tagSeq).toString(36)}`) as Tagger;
    (t as { run: string }).run = TAG;
    await use(t);
  },

  cleanup: async ({}, use) => {
    const fns: Array<() => Promise<unknown> | unknown> = [];
    await use((fn) => void fns.push(fn));
    // Best-effort, newest first; a failing cleanup never fails the test (but is logged).
    for (const fn of fns.reverse()) {
      try {
        await fn();
      } catch (e) {
        console.warn(`[e2e cleanup] ${String(e).split("\n")[0]}`);
      }
    }
  },

  anon: async ({ browser, guard }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const ctx = await browser.newContext();
      ctx.on("page", (pg) => (guard as unknown as { _attach(p: Page): void })._attach(pg));
      contexts.push(ctx);
      return ctx.newPage();
    });
    for (const c of contexts) await c.close();
  },

  loginAs: async ({ browser, guard }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (email, password) => {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => {
        window.print = () => {};
      });
      ctx.on("page", (pg) => (guard as unknown as { _attach(p: Page): void })._attach(pg));
      contexts.push(ctx);
      const page = await ctx.newPage();
      await page.goto("/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
      return page;
    });
    for (const c of contexts) await c.close();
  },

  as: async ({ browser, guard }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role: Role) => {
      const ctx = await browser.newContext({ storageState: authFile(role) });
      ctx.on("page", (pg) => (guard as unknown as { _attach(p: Page): void })._attach(pg));
      // The app's "print" is window.open() + window.print(); in headed mode that
      // pops the blocking OS print dialog. We assert on the popup's HTML, not the
      // dialog, so neutralise print() everywhere.
      await ctx.addInitScript(() => {
        window.print = () => {};
      });
      contexts.push(ctx);
      return ctx.newPage();
    });
    for (const c of contexts) await c.close();
  },

  api: async ({}, use) => {
    const ctxs: APIRequestContext[] = [];
    await use(async (role: Role) => {
      const c = await apiAs(role);
      ctxs.push(c);
      return c;
    });
    for (const c of ctxs) await c.dispose();
  },
});

//JJQR - END

export { expect };
//JJQR - AI (Nov 19, 2026) - pre-existing fix: specs import { type Page } from "../support/fixtures" but it was never exported (TS2459)
export type { Page };
//JJQR - END
