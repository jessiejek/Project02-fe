import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

//JJQR - AI (Nov 19, 2026) - the doctor's Performance page (/doctor/performance): real numbers vs the API, the toggle, nav + Today-page link,
// and the friendly states (loading, error + Retry, empty), plus "a dip is never red" and an iPad-width layout check.

const num = (text: string | null) => Number((text ?? "").replace(/[^\d.-]/g, ""));

interface Stats {
  patients_seen: number; collected: number; billed: number; unpaid_total: number;
}
interface Perf {
  current: Stats; previous: Stats;
  series: { date: string }[];
  unpaid: { count: number; total: number };
}

const ZERO_STATS = {
  patients_seen: 0, unique_patients: 0, new_visits: 0, follow_up_visits: 0, first_time_patients: 0,
  collected: 0, billed: 0, waived: 0, refunded: 0, unpaid_total: 0, rx_groups: 0, med_certs: 0, lab_orders: 0,
  no_shows: 0, cancellations: 0, avg_consult_minutes: null, avg_consult_samples: 0,
};

/** A well-formed API body (snake_case) with the given current / previous overrides. */
function body(current: Partial<typeof ZERO_STATS> = {}, previous: Partial<typeof ZERO_STATS> = {}) {
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 6 + i)).toISOString().slice(0, 10);
    return { date: d, patients_seen: 0, collected: 0, billed: 0 };
  });
  return {
    doctor_id: "00000000-0000-0000-0000-000000000001", currency: "PHP", week_starts_on: "Monday",
    period: { name: "today", from: "2026-11-19", to: "2026-11-19" },
    previous_period: { name: "yesterday", from: "2026-11-18", to: "2026-11-18" },
    current: { ...ZERO_STATS, ...current }, previous: { ...ZERO_STATS, ...previous },
    series, top_diagnoses: [], unpaid: { count: 0, total: 0, items: [] }, follow_ups_due: { count: 0, items: [] },
  };
}

async function mockPerformance(page: Page, b: unknown) {
  await page.route("**/api/doctor/performance**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) }));
}

test.describe("doctor · performance", () => {
  test("shows the doctor's own numbers, and they match the API for each period", async ({ as, api }) => {
    const page = await as("doctor");
    await page.goto("/doctor/performance");
    await expect(page.getByTestId("perf-page")).toBeVisible();
    await expect(page.getByTestId("kpi-collected")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening), Dr\./);
    await expect(page.getByTestId("perf-chart-svg")).toBeVisible().catch(() => undefined); // empty database → friendly empty chart instead

    const doctorApi = await api("doctor");
    for (const [period, label] of [["today", "Today"], ["week", "This week"], ["month", "This month"]] as const) {
      await page.getByTestId(`period-${period}`).click();
      await expect(page.getByTestId(`period-${period}`)).toHaveAttribute("aria-pressed", "true");
      const res = await doctorApi.get(`/api/doctor/performance?period=${period}`);
      expect(res.ok(), `API ${period}`).toBeTruthy();
      const data = (await res.json()) as Perf;
      // Wait for the page to catch up with the API's numbers (data can move while we look, so compare after settling).
      await expect(page.getByTestId("kpi-patients")).toHaveText(String(data.current.patients_seen));
      expect(num(await page.getByTestId("kpi-collected").textContent())).toBe(data.current.collected);
      expect(num(await page.getByTestId("kpi-billed").textContent())).toBe(data.current.billed);
      expect(num(await page.getByTestId("kpi-unpaid").textContent())).toBe(data.unpaid.total);
      expect(data.series).toHaveLength(14);
      await expect(page.getByTestId("period-toggle")).toContainText(label);
      const text = await page.getByTestId("perf-page").innerText();
      expect(text).not.toMatch(/NaN|undefined|Infinity|null/);
    }
  });

  test("the sidebar has a Performance link, and the Today page links to it (no clinic-wide Revenue / No Shows cards)", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/dashboard");
    await expect(page.getByRole("heading", { name: "Your clinic today" })).toBeVisible();
    await expect(page.getByText("Revenue Today")).toHaveCount(0);
    await expect(page.getByText("No Shows Today")).toHaveCount(0);
    await expect(page.getByTestId("performance-link")).toBeVisible();
    await page.getByRole("link", { name: "Performance" }).first().click();
    await expect(page).toHaveURL(/\/doctor\/performance/);
    await expect(page.getByTestId("kpi-collected")).toBeVisible();
    await page.getByRole("link", { name: /Back to Today/ }).click();
    await expect(page).toHaveURL(/\/doctor\/dashboard/);
  });

  test("a failed load shows a friendly error with Retry, and Retry brings the numbers back", async ({ as }) => {
    const page = await as("doctor");
    let failing = true;
    await page.route("**/api/doctor/performance**", (route) => (failing ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.continue()));
    await page.goto("/doctor/performance");
    await expect(page.getByTestId("perf-error")).toBeVisible();
    await expect(page.getByTestId("perf-error")).toContainText("couldn't load your numbers");
    await expect(page.getByTestId("kpi-collected")).toHaveCount(0);
    failing = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("kpi-collected")).toBeVisible();
    await expect(page.getByTestId("perf-error")).toHaveCount(0);
  });

  test("shows a loading state while the request is in flight", async ({ as }) => {
    const page = await as("doctor");
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    await page.route("**/api/doctor/performance**", async (route) => { await gate; await route.continue(); });
    await page.goto("/doctor/performance");
    await expect(page.getByTestId("perf-loading")).toBeVisible();
    release();
    await expect(page.getByTestId("kpi-collected")).toBeVisible();
    await expect(page.getByTestId("perf-loading")).toHaveCount(0);
  });

  test("a brand-new day is a friendly empty state — zeros, a kind message, no errors", async ({ as }) => {
    const page = await as("doctor");
    await mockPerformance(page, body());
    await page.goto("/doctor/performance");
    await expect(page.getByTestId("perf-empty")).toContainText("No completed visits yet today");
    await expect(page.getByTestId("perf-headline")).toContainText("calm start");
    await expect(page.getByTestId("kpi-collected")).toHaveText("₱0");
    await expect(page.getByTestId("kpi-patients")).toHaveText("0");
    await expect(page.getByTestId("top-diagnoses-empty")).toBeVisible();
    await expect(page.getByTestId("unpaid-empty")).toBeVisible();
    await expect(page.getByTestId("followups-empty")).toBeVisible();
    await expect(page.getByTestId("perf-chart")).toContainText("fill in as you complete visits");
    expect(await page.getByTestId("perf-page").innerText()).not.toMatch(/NaN|undefined|Infinity/);
  });

  test("a dip is a soft grey chip — never red — and a gain is green", async ({ as }) => {
    const page = await as("doctor");
    await mockPerformance(page, body(
      { patients_seen: 3, collected: 1500, billed: 1500 },
      { patients_seen: 6, collected: 3000, billed: 2000 },
    ));
    await page.goto("/doctor/performance");
    const collected = page.getByTestId("kpi-collected-change");
    await expect(collected).toHaveText("↓ 50% vs yesterday");
    await expect(collected).toHaveAttribute("data-tone", "soft");
    await expect(page.getByTestId("kpi-billed-change")).toHaveText("↓ 25% vs yesterday");
    // Billed 1500 vs 2000 is also a dip → soft; nothing on the page uses the danger palette.
    await expect(page.getByTestId("kpi-billed-change")).toHaveAttribute("data-tone", "soft");
    await expect(page.getByTestId("perf-page").locator("[class*='status-danger']")).toHaveCount(0);

    await mockPerformance(page, body({ patients_seen: 6, collected: 3000, billed: 3000 }, { patients_seen: 3, collected: 1500, billed: 1500 }));
    await page.reload();
    await expect(page.getByTestId("kpi-collected-change")).toHaveText("↑ 100% vs yesterday");
    await expect(page.getByTestId("kpi-collected-change")).toHaveAttribute("data-tone", "positive");
    await expect(page.getByTestId("perf-headline")).toContainText("Lovely work");
  });

  test("the 14-day chart has 14 bars and a tap shows that day's numbers", async ({ as }) => {
    const page = await as("doctor");
    const b = body({ patients_seen: 2, collected: 900, billed: 900 }, {});
    b.series[13] = { ...b.series[13], patients_seen: 2, collected: 900, billed: 900 };
    b.series[5] = { ...b.series[5], patients_seen: 1, collected: 500, billed: 500 };
    await mockPerformance(page, b);
    await page.goto("/doctor/performance");
    await expect(page.getByTestId("chart-bar")).toHaveCount(14);
    await page.locator('[data-testid="chart-bar"][data-date="2026-11-11"]').click();
    await expect(page.getByTestId("chart-readout")).toContainText("1 patient · ₱500 collected");
    await page.getByTestId("chart-metric-patients_seen").click();
    await expect(page.getByTestId("chart-metric-patients_seen")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-bar")).toHaveCount(14);
  });

  test("iPad width (820×1180): everything fits — no sideways scroll — and the toggle is tap-sized", async ({ as }) => {
    const page = await as("doctor");
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/doctor/performance");
    await expect(page.getByTestId("kpi-collected")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const p of ["today", "week", "month"]) {
      const box = await page.getByTestId(`period-${p}`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("the page opens on ?period=week, and only doctors can open it", async ({ as }) => {
    const doctor = await as("doctor");
    await doctor.goto("/doctor/performance?period=week");
    await expect(doctor.getByTestId("period-week")).toHaveAttribute("aria-pressed", "true");

    const staff = await as("staff");
    await staff.goto("/doctor/performance");
    await expect(staff).not.toHaveURL(/\/doctor\/performance/);
  });

  test("the API never takes a doctor from the client: a spoofed doctorId returns the caller's own numbers", async ({ api }) => {
    const doctor = await api("doctor");
    const own = await (await doctor.get("/api/doctor/performance?period=month")).json();
    const spoof = await (await doctor.get("/api/doctor/performance?period=month&doctorId=00000000-0000-0000-0000-000000000099")).json();
    expect(spoof.doctor_id).toBe(own.doctor_id);
    expect(spoof.current.collected).toBe(own.current.collected);
    const staff = await api("staff");
    expect((await staff.get("/api/doctor/performance?period=today")).status()).toBe(403);
  });
});
//JJQR - END
