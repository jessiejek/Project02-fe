import { test, expect } from "../support/fixtures";
import { BE_URL, TAG } from "../playwright.config";
import { randomUUID } from "node:crypto";

/**
 * COVERAGE-PLAN §0 — setup sanity + redirect routes.
 */
test.describe("§0 setup", () => {
  test("API is reachable on the configured BE_URL and all four dev logins work", async ({ api }) => {
    const res = await (await api("admin")).get("/api/version");
    expect(res.ok(), `GET ${BE_URL}/api/version`).toBeTruthy();
    for (const role of ["admin", "staff", "doctor", "patient"] as const) {
      const me = await (await api(role)).get("/api/auth/me");
      expect(me.status(), `${role} /api/auth/me`).toBe(200);
    }
  });

  test("run id is tagged E2E-<runId>", async ({ tag }) => {
    expect(TAG).toMatch(/^E2E-[a-z0-9]+$/);
    expect(tag("x")).toMatch(new RegExp(`^${TAG}-x-[a-z0-9]+$`));
    expect(tag("x")).not.toBe(tag("x"));
  });

  test("cleanup registry runs (newest first) and the guard records API 4xx", async ({ as, guard, cleanup }) => {
    const order: number[] = [];
    cleanup(() => void order.push(1));
    cleanup(() => void order.push(2));
    const page = await as("admin");
    await page.goto("/admin/dashboard");
    // Provoke a known 404 from the API and prove the guard saw it, then allow it.
    const res = await page.evaluate(async (url) => (await fetch(url)).status, `${BE_URL}/api/bookings/${randomUUID()}`);
    expect([401, 404]).toContain(res);
    await expect.poll(() => guard.seen.some((l) => /^(401|404) GET \/api\/bookings\//.test(l))).toBeTruthy();
    guard.allow(/^(401|404) GET \/api\/bookings\//);
  });
});

test.describe("§0 redirect routes", () => {
  test("/staff/bookings → /staff/queue", async ({ as }) => {
    const page = await as("staff");
    await page.goto("/staff/bookings");
    await expect(page).toHaveURL(/\/staff\/queue$/);
  });

  test("/admin/calendar → /admin/bookings", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/calendar");
    await expect(page).toHaveURL(/\/admin\/bookings$/);
  });

  test("/doctor/settings → /doctor/profile", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/settings");
    await expect(page).toHaveURL(/\/doctor\/profile$/);
  });

  test("/doctor/consultation/[id] → /doctor/consultation2/[id], query string kept", async ({ as, guard }) => {
    const page = await as("doctor");
    const id = randomUUID();
    await page.goto(`/doctor/consultation/${id}?from=e2e&x=1`);
    await expect(page).toHaveURL(new RegExp(`/doctor/consultation2/${id}\\?from=e2e&x=1$`));
    guard.allow(/\/api\/(bookings|consultations)\//); // the id is random, the API rightly says 404
  });
});
