import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { authFile } from "./auth";
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
type Fixtures = {
  as: (role: Role) => Promise<Page>;
  api: (role: Role) => Promise<APIRequestContext>;
};

export const test = base.extend<Fixtures>({
  as: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role: Role) => {
      const ctx = await browser.newContext({ storageState: authFile(role) });
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

export { expect };
