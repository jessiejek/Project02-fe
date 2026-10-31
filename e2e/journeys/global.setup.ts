import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { DEV_PASSWORD } from "../playwright.config";
import { AUTH_DIR, authFile, EMAIL, ROLES } from "../support/auth";

for (const role of ROLES) {
  setup(`authenticate ${role}`, async ({ page }) => {
    mkdirSync(AUTH_DIR, { recursive: true });
    await page.goto("/login");
    //JJQR - AI (Oct 31, 2026) — #password avoids Show-password aria-label clash with getByLabel("Password")
    await page.locator("#email").fill(EMAIL[role]);
    await page.locator("#password").fill(DEV_PASSWORD);
    //JJQR - END
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((u) => u.pathname.includes(`/${role}/dashboard`), { timeout: 25_000 });
    await expect(page).toHaveURL(new RegExp(`/${role}/dashboard`));
    await page.context().storageState({ path: authFile(role) });
  });
}
