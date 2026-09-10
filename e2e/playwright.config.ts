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
export const BE_URL = process.env.E2E_BE_URL ?? "http://localhost:5000";
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
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { slowMo: SLOWMO } },
      dependencies: ["setup"],
    },
  ],
});
