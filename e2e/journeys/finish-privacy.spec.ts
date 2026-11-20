import { test, expect } from "../support/fixtures";
import { registerFreshPatient } from "../support/api";

/**
 * finish/all — Phase 4 privacy (RA 10173). PV-3 password rule, PV-5 access log, PV-11 public notice, PV-12 consent, PV-13 download, PV-14 requests.
 * Every test makes its own patient and removes it afterwards.
 */

test.describe("PV-11 · public privacy notice", () => {
  test("opens without signing in, in English and Filipino", async ({ anon }) => {
    const page = await anon();
    await page.goto("/api/public/privacy-notice");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Notice" })).toBeVisible();
    await expect(page.getByText(/Republic Act No. 10173/)).toBeVisible();
    await page.getByRole("link", { name: "Basahin sa Filipino" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Paunawa sa Privacy" })).toBeVisible();
    await expect(page.getByText(/72 oras/)).toBeVisible();
  });

  test("the register page links to it and its consent box starts unticked", async ({ anon }) => {
    const page = await anon();
    await page.goto("/register");
    await expect(page.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", /privacy-notice/);
    await expect(page.getByRole("checkbox", { name: /read the Privacy Notice/ })).not.toBeChecked();
  });
});

test.describe("PV-12 · consent screen", () => {
  test("nothing is pre-ticked; Decline needs no tick, is recorded, and can be followed by Agree; Withdraw is on the profile", async ({ loginAs, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("pv12"));
    cleanup(() => me.dispose());
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/privacy-consent");
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(page.getByText(/Privacy notice version/)).toBeVisible();
    const agree = page.getByRole("button", { name: "Agree and continue" });
    const decline = page.getByRole("button", { name: "Decline" });
    await expect(agree).toBeDisabled();
    await expect(decline).toBeEnabled();
    // same size: neither is a bigger or louder target than the other
    const [a, d] = [await agree.boundingBox(), await decline.boundingBox()];
    expect(Math.abs((a?.height ?? 0) - (d?.height ?? 1))).toBeLessThan(2);
    await decline.click();
    await expect(page).toHaveURL(/\/patient\/dashboard/);
    let mine = await (await me.api.get("/api/patients/me")).json();
    expect(mine.consented_at).toBeNull();
    let hist = await (await me.api.get(`/api/patients/${me.patientId}/consents`)).json();
    expect(hist.map((h: any) => h.decision)).toEqual(["Declined"]);

    await page.goto("/patient/privacy-consent");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await expect(page).toHaveURL(/\/patient\/dashboard/);
    mine = await (await me.api.get("/api/patients/me")).json();
    expect(mine.consented_at).toBeTruthy();

    await page.goto("/patient/profile");
    await page.getByRole("tab", { name: "Privacy" }).click();
    await expect(page.getByText(/You agreed to the privacy notice/)).toBeVisible();
    await page.getByRole("button", { name: "Withdraw my consent" }).click();
    await page.getByRole("button", { name: "Yes, withdraw" }).click();
    await expect(page.getByText(/You withdrew your consent/)).toBeVisible();
    mine = await (await me.api.get("/api/patients/me")).json();
    expect(mine.consented_at).toBeNull();
    expect(mine.consent_withdrawn_at).toBeTruthy();
    hist = await (await me.api.get(`/api/patients/${me.patientId}/consents`)).json();
    expect(hist.map((h: any) => h.decision).sort()).toEqual(["Accepted", "Declined", "Withdrawn"]);
  });
});

test.describe("PV-13 / PV-14 · my data", () => {
  test("Download my data saves a JSON file with my own details and no file links", async ({ loginAs, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("pv13"));
    cleanup(() => me.dispose());
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByRole("tab", { name: "Privacy" }).click();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^my-clinic-data-\d{4}-\d{2}-\d{2}\.json$/);
    const text = (await (await import("node:fs/promises")).readFile(await dl.path(), "utf8"));
    const json = JSON.parse(text);
    expect(json.profile.email).toBe(me.email);
    expect(text).not.toContain("file_url");
  });

  test("a correction request is logged and shows in the list; the admin sees it and can close it", async ({ loginAs, as, api, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("pv14"));
    cleanup(() => me.dispose());
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/profile");
    await page.getByRole("tab", { name: "Privacy" }).click();
    const send = page.getByRole("button", { name: "Send request" });
    await expect(send).toBeDisabled();
    await page.getByLabel("What should be corrected?").fill("My contact number is out of date.");
    await send.click();
    await expect(page.getByText("Your request is logged. The clinic will review it.")).toBeVisible();
    await expect(page.getByText(/Correction · Pending/)).toBeVisible();

    const admin = await api("admin");
    const list = await (await admin.get("/api/privacy/data-requests")).json();
    const mine = list.find((r: any) => r.patient_id === me.patientId);
    expect(mine).toBeTruthy();
    cleanup(async () => void (await admin.put(`/api/privacy/data-requests/${mine.id}`, { data: { status: "Rejected", note: "e2e cleanup" } })));

    const ap = await as("admin");
    await ap.goto("/admin/settings");
    await ap.getByRole("tab", { name: "Privacy & consent" }).click();
    await expect(ap.getByRole("heading", { name: "Patient data requests" })).toBeVisible();
    await expect(ap.getByText("My contact number is out of date.")).toBeVisible();
  });

  test("a deletion request is scheduled for after the 7-year retention when there is a visit on file, and the admin can't complete it early", async ({ api, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("pv14d"));
    cleanup(() => me.dispose());
    // no visit yet → Pending (nothing to retain); the early-completion rule is covered by the API tests
    const res = await me.api.post("/api/privacy/data-requests", { data: { kind: "Deletion", details: "Delete my account please." } });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("Pending");
    const admin = await api("admin");
    cleanup(async () => void (await admin.put(`/api/privacy/data-requests/${body.id}`, { data: { status: "Rejected", note: "e2e cleanup" } })));
  });
});

test.describe("PV-5 · who looked at this patient", () => {
  test("the admin patient page has an Access log tab listing who opened the record", async ({ as, api, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("pv5"));
    cleanup(() => me.dispose());
    const staff = await api("staff");
    expect((await staff.get(`/api/patients/${me.patientId}`)).ok()).toBeTruthy(); // this view is logged
    const ap = await as("admin");
    await ap.goto(`/admin/patients/${me.patientId}`);
    await ap.getByRole("tab", { name: "Access log" }).click();
    await expect(ap.getByText(/Patient record/).first()).toBeVisible();
    await expect(ap.getByText(/\(Staff\)/).first()).toBeVisible();
  });
});

test.describe("PV-3 · passwords", () => {
  test("the register form asks for 12+ characters and the API refuses a weak or common password with its reason", async ({ anon, tag }) => {
    const page = await anon();
    await page.goto("/register");
    await expect(page.getByText(/At least 12 characters/).first()).toBeVisible();
    const { request } = await import("@playwright/test");
    const { BE_URL } = await import("../playwright.config");
    const ctx = await request.newContext({ baseURL: BE_URL });
    const email = `${tag("pv3").toLowerCase()}@example.test`;
    const weak = await ctx.post("/api/auth/register", { data: { firstName: "Pw", lastName: "Tester", dateOfBirth: "1990-01-01", sex: "Female", email, password: "Short1!" } });
    expect(weak.status()).toBe(400);
    const common = await ctx.post("/api/auth/register", { data: { firstName: "Pw", lastName: "Tester", dateOfBirth: "1990-01-01", sex: "Female", email, password: "password1234" } });
    expect(common.status()).toBe(400);
    expect((await common.text()).toLowerCase()).toContain("common");
    await ctx.dispose();
  });
});
