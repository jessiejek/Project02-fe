import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { BE_URL, DEV_PASSWORD } from "../playwright.config";
import { AUTH_DIR, authFile, EMAIL, ROLES } from "../support/auth";
import { apiAs } from "../support/api";
import { cancelOwnE2eBookings, sweepE2eQueueLeftovers } from "../support/visit";

//JJQR - AI (Nov 20, 2026) - wrap-up step 5: repeated runs must never find a seeded test account locked out.
// Clears failed_login_count / locked_until for the seeded @clinic.test accounts in the LOCAL Docker dev DB only (the SA password stays
// inside the container: it is read there from MSSQL_SA_PASSWORD). Skipped when the API is not on this machine.
setup("reset lockout of seeded test accounts", () => {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BE_URL)) { console.log("[e2e lockout reset] API is not local — skipped"); return; }
  const sql = `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE email LIKE N'%@clinic.test' AND (failed_login_count <> 0 OR locked_until IS NOT NULL)`;
  try {
    execFileSync("docker", ["exec", process.env.E2E_DB_CONTAINER ?? "clinic-mssql", "bash", "-c",
      `/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -No -d ClinicAppDb -b -Q "${sql}"`], { stdio: "pipe" });
    console.log("[e2e lockout reset] seeded test accounts unlocked");
  } catch (e) {
    console.log(`[e2e lockout reset] could not reset (docker/clinic-mssql unavailable?): ${(e as Error).message.split("\n")[0]}`);
  }
});
//JJQR - END

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
  const patient = await apiAs("patient");
  console.log(`[e2e sweep] cancelled ${await cancelOwnE2eBookings(patient)} leftover E2E patient bookings`);
  await patient.dispose();
});
//JJQR - END
