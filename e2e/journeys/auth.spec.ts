import { test, expect } from "../support/fixtures";
import type { Role } from "../support/api";

const ROLES: Role[] = ["admin", "staff", "doctor", "patient"];

test.describe("auth & role gating", () => {
  test("logged-out user is sent to /login", async ({ browser }) => {
    const ctx = await browser.newContext(); // no storageState
    const page = await ctx.newPage();
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  for (const role of ROLES) {
    test(`${role} lands on its own dashboard`, async ({ as }) => {
      const page = await as(role);
      await page.goto(`/${role}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`/${role}/dashboard`));
    });

    test(`${role} cannot reach another portal`, async ({ as }) => {
      const page = await as(role);
      const other = ROLES.find((r) => r !== role)!;
      await page.goto(`/${other}/dashboard`);
      // proxy.ts bounces you back to your own dashboard
      await expect(page).toHaveURL(new RegExp(`/${role}/dashboard`));
    });
  }
});
