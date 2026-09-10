import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { DEV_PASSWORD } from "../playwright.config";
import { AUTH_DIR, authFile, EMAIL, ROLES } from "../support/auth";

for (const role of ROLES) {
  setup(`authenticate ${role}`, async ({ page }) => {
    mkdirSync(AUTH_DIR, { recursive: true });
    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL[role]);
    await page.getByLabel("Password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(`**/${role}/dashboard`, { timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`/${role}/dashboard`));
    await page.context().storageState({ path: authFile(role) });
  });
}
