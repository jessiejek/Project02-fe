import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { DEV_PASSWORD } from "../playwright.config";
import { AUTH_DIR, authFile, EMAIL, ROLES } from "../support/auth";
import { apiAs } from "../support/api";
import { sweepE2eQueueLeftovers } from "../support/visit";

for (const role of ROLES) {
  setup(`authenticate ${role}`, async ({ page }) => {
    mkdirSync(AUTH_DIR, { recursive: true });
    await page.goto("/login");
    //JJQR - AI (Oct 31, 2026) — #password avoids Show-password aria-label clash with getByLabel("Password")
    await page.locator("#email").fill(EMAIL[role]);
    await page.locator("#password").fill(DEV_PASSWORD);
    //JJQR - END
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((u) => u.pathname.includes(`/${role}/dashboard`), { timeout: 90_000 });
    await expect(page).toHaveURL(new RegExp(`/${role}/dashboard`));
    await page.context().storageState({ path: authFile(role) });
  });
}

//JJQR - AI (Nov 20, 2026) - batch 2: start every run from a clean slate of E2E-named queue rows (see sweepE2eQueueLeftovers)
setup("sweep leftover E2E queue rows", async () => {
  setup.setTimeout(180_000);
  const staff = await apiAs("staff");
  const r = await sweepE2eQueueLeftovers(staff);
  console.log(`[e2e sweep] settled ${r.settled} unpaid E2E visits, cancelled ${r.cancelled} open E2E queue rows`);
  await staff.dispose();
});
//JJQR - END
