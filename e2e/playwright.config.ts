import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the clinic app. Drives the real FE (:3000) against the
 * real .NET API (:5000) + SQL Server. Nothing is mocked.
 *
 * Prereqs (see e2e/README.md):
 *   - Project02-be running:  ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/ClinicApp.Api
 *   - Project02-fe running:  npm run dev        (port 3000)
 *   - Dev accounts seeded:   {admin,staff,doctor,patient}@clinic.test / ClinicDev123!
 *
 * Run:  npm run test:e2e        (headless)
 *       npm run test:e2e:ui     (Playwright UI mode)
 */

export const FE_URL = process.env.E2E_FE_URL ?? "http://localhost:3000";
//JJQR - AI (Nov 19, 2026) - API default was :5000 but .env.local's NEXT_PUBLIC_API_URL runs the API on :5055, so api(role) seeding/cleanup hit the wrong port
export const BE_URL = process.env.E2E_BE_URL ?? "http://127.0.0.1:5055";
//JJQR - END

//JJQR - AI (Nov 19, 2026) - one run id per `playwright test` invocation; every test tags its data E2E-<runId>
// Set on process.env so forked workers inherit the same value as the main process.
process.env.E2E_RUN_ID ??= Date.now().toString(36).slice(-6);
export const RUN_ID = process.env.E2E_RUN_ID;
export const TAG = `E2E-${RUN_ID}`;
//JJQR - END
export const DEV_PASSWORD = "ClinicDev123!";

// Watch the run: `E2E_SLOWMO=350 npm run test:e2e:headed` slows every action so
// you can see the browser move. 0 in CI / normal headless runs.
const SLOWMO = Number(process.env.E2E_SLOWMO ?? 0);

export default defineConfig({
  testDir: "./journeys",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared DB — keep journeys sequential
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    baseURL: FE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    //JJQR - AI (Nov 19, 2026) - first login of a role cold-compiles its dashboard in `next dev` and can exceed the timeout; retry the setup once
    { name: "setup", testMatch: /global\.setup\.ts/, retries: 2, timeout: 120_000 },
    //JJQR - END
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { slowMo: SLOWMO } },
      dependencies: ["setup"],
    },
  ],
});
