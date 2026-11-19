import { test, expect } from "../support/fixtures";
import { request, type Page } from "@playwright/test";
import { BE_URL } from "../playwright.config";
import { cancelQueueByName, cancelQueueEntry, checkInWalkIn, createTaggedPatient, queueFor, getQueue, getBooking } from "../support/api";

/** COVERAGE-PLAN §3 · Staff: walk-in wizard (staff + admin) and the queue board */

async function seedPatient(
  { api, tag, cleanup }: { api: (r: "staff") => Promise<import("@playwright/test").APIRequestContext>; tag: (l?: string) => string; cleanup: (f: () => unknown) => void },
  label: string, extra: Record<string, unknown> = {},
) {
  const staff = await api("staff");
  const name = tag(label);
  const p = await createTaggedPatient(staff, name, extra);
  cleanup(() => cancelQueueByName(staff, name));
  return { name, fullName: `${name} Tester`, p, staff };
}

async function pickPatient(page: Page, search: string) {
  await page.getByRole("searchbox", { name: "Search patients" }).fill(search);
  await page.getByRole("radio", { name: new RegExp(search, "i") }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Confirm the visit" })).toBeVisible();
}

for (const role of ["staff", "admin"] as const) {
  test.describe(`/${role}/walk-in`, () => {
    test(`[${role}] search → select → confirm → ticket with a queue number; entry is in today's queue`, async ({ as, api, tag, cleanup }) => {
      const { name, fullName, staff } = await seedPatient({ api, tag, cleanup }, `wi-${role}`);
      const page = await as(role);
      await page.goto(`/${role}/walk-in`);
      await pickPatient(page, name);
      await page.getByRole("button", { name: "Check in and get queue number" }).click();
      await expect(page.getByRole("heading", { name: `${fullName} is checked in` })).toBeVisible();
      await expect(page.getByText(/^Q-\d+$/).first()).toBeVisible();
      const entries = await queueFor(staff, name);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ status: "CheckedIn", visit_type: "New", is_walk_in: true });
      await expect(page.getByText(entries[0].queue_number).first()).toBeVisible();
    });
  });
}

test.describe("/staff/walk-in · step 1 (find the patient)", () => {
  test("Continue is disabled until a patient is selected", async ({ as, api, tag, cleanup }) => {
    const { name } = await seedPatient({ api, tag, cleanup }, "wi-cont");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await page.getByRole("searchbox", { name: "Search patients" }).fill(name);
    await page.getByRole("radio", { name: new RegExp(name, "i") }).check();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("search by name, by patient code and by e-mail finds the patient; a nonsense search offers to register", async ({ as, api, tag, cleanup }) => {
    const { name, p } = await seedPatient({ api, tag, cleanup }, "wi-find");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    const box = page.getByRole("searchbox", { name: "Search patients" });
    const row = page.getByRole("radio", { name: new RegExp(name, "i") });
    for (const q of [name, name.toUpperCase(), p.patient_code, `${name.toLowerCase()}@example.test`]) {
      await box.fill(q);
      await expect(row, `search "${q}"`).toBeVisible();
    }
    await box.fill(`zz-nobody-${tag("x")}`);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Register them as a new patient" })).toBeVisible();
  });

  test("paging: Next shows page 2 and Previous returns", async ({ as }) => {
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await expect(page.getByRole("radio").first()).toBeVisible();
    const prev = page.getByRole("button", { name: "Previous" });
    const next = page.getByRole("button", { name: "Next" });
    test.skip(!(await next.isEnabled()), "fewer than one page of patients");
    await expect(prev).toBeDisabled();
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
    await next.click();
    await expect(page.getByText(/^2 of \d+$/)).toBeVisible();
    await expect(prev).toBeEnabled();
    await prev.click();
    await expect(page.getByText(/^1 of \d+$/)).toBeVisible();
  });
});

test.describe("/staff/walk-in · quick register", () => {
  const dlg = (page: Page) => page.getByRole("dialog", { name: "Register a new patient" });
  async function fill(page: Page, v: { first?: string; last?: string; dob?: string; sex?: string; contact?: string; address?: string }) {
    const d = dlg(page);
    if (v.first !== undefined) await d.getByLabel("First name").fill(v.first);
    if (v.last !== undefined) await d.getByLabel("Last name").fill(v.last);
    if (v.dob !== undefined) await d.getByLabel("Date of birth").fill(v.dob);
    if (v.sex !== undefined) await d.getByLabel("Sex").selectOption(v.sex);
    if (v.contact !== undefined) await d.getByLabel(/Contact number/).fill(v.contact);
    if (v.address !== undefined) await d.getByLabel(/Address/).fill(v.address);
  }
  const base = (first: string) => ({ first, last: "Quick", dob: "1991-02-03", sex: "Female" });

  test("happy path: register → auto-selected → check in → patient exists with the entered details", async ({ as, api, tag, cleanup }) => {
    const staff = await api("staff");
    const first = tag("qr");
    cleanup(() => cancelQueueByName(staff, first));
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await page.getByRole("button", { name: "Register new patient" }).click();
    await fill(page, { ...base(first), contact: "09175550101", address: "1 Quick St" });
    await dlg(page).getByRole("button", { name: "Register and select" }).click();
    await expect(dlg(page)).toBeHidden();
    await expect(page.getByRole("radio", { name: new RegExp(first, "i") })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Check in and get queue number" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`${first} Quick is checked in`, "i") })).toBeVisible();
    const found: any[] = await (await staff.get(`/api/patients?search=${first}`)).json();
    expect(found).toHaveLength(1);
    expect(found[0].first_name.toLowerCase()).toBe(first.toLowerCase()); // the app Title-Cases names (E2E → E2e)
    expect(found[0]).toMatchObject({ last_name: "Quick", sex: "Female", date_of_birth: "1991-02-03", contact_number: "09175550101", address: "1 Quick St" });
    expect(await queueFor(staff, first)).toHaveLength(1);
  });

  test("each required field empty keeps 'Register and select' disabled", async ({ as, tag }) => {
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await page.getByRole("button", { name: "Register new patient" }).click();
    const submit = dlg(page).getByRole("button", { name: "Register and select" });
    await expect(submit).toBeDisabled();
    const full = base(tag("req"));
    await fill(page, { first: full.first, last: full.last, dob: full.dob }); // sex still empty
    await expect(submit, "missing sex").toBeDisabled();
    await fill(page, { sex: full.sex });
    await expect(submit).toBeEnabled();
    for (const [field, label, value] of [["first", "First name", full.first], ["last", "Last name", full.last], ["dob", "Date of birth", full.dob]] as const) {
      await dlg(page).getByLabel(label).fill("");
      await expect(submit, `missing ${field}`).toBeDisabled();
      await dlg(page).getByLabel(label).fill(value);
      await expect(submit).toBeEnabled();
    }
    await dlg(page).getByLabel("First name").fill("   "); // whitespace only counts as empty
    await expect(submit, "whitespace-only first name").toBeDisabled();
  });

  test("a future date of birth is not accepted", async ({ as, api, tag, cleanup }) => {
    test.fail(true, "BUG-14: quick-register accepts a date of birth in year 2999 (max= is only a hint; no check in UI or API)");
    const staff = await api("staff");
    const first = tag("qrfut");
    cleanup(() => cancelQueueByName(staff, first));
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await page.getByRole("button", { name: "Register new patient" }).click();
    await fill(page, { ...base(first), dob: "2999-01-01" });
    const submit = dlg(page).getByRole("button", { name: "Register and select" });
    if (await submit.isEnabled()) await submit.click();
    await page.waitForTimeout(800);
    const found: any[] = await (await staff.get(`/api/patients?search=${first}`)).json();
    expect(found, "a patient born in year 2999 must not be created").toHaveLength(0);
  });

  test("absurdly long names and a non-numeric phone are rejected (nothing stored)", async ({ as, api, tag, cleanup }) => {
    test.fail(true, "BUG-15: quick-register stores a 400-character surname and the phone 'abc-not-a-phone' (no length/format validation)");
    const staff = await api("staff");
    const first = tag("qrbad");
    cleanup(() => cancelQueueByName(staff, first));
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await page.getByRole("button", { name: "Register new patient" }).click();
    await fill(page, { ...base(first), last: "L".repeat(400), contact: "abc-not-a-phone" });
    const submit = dlg(page).getByRole("button", { name: "Register and select" });
    if (await submit.isEnabled()) await submit.click();
    await page.waitForTimeout(800);
    const found: any[] = await (await staff.get(`/api/patients?search=${first}`)).json();
    expect(found, "400-char surname + 'abc-not-a-phone' must not be saved").toHaveLength(0);
  });

  test("Cancel closes the dialog and creates nothing", async ({ as, api, tag }) => {
    const staff = await api("staff");
    const first = tag("qrcancel");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await page.getByRole("button", { name: "Register new patient" }).click();
    await fill(page, base(first));
    await dlg(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dlg(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(await (await staff.get(`/api/patients?search=${first}`)).json()).toHaveLength(0);
  });

  test("double-click on 'Register and select' creates exactly one patient (B5)", async ({ as, api, tag, cleanup }) => {
    const staff = await api("staff");
    const first = tag("qrdbl");
    cleanup(() => cancelQueueByName(staff, first));
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await page.getByRole("button", { name: "Register new patient" }).click();
    await fill(page, base(first));
    await dlg(page).getByRole("button", { name: "Register and select" }).dblclick();
    await expect(dlg(page)).toBeHidden();
    await page.waitForTimeout(500);
    expect(await (await staff.get(`/api/patients?search=${first}`)).json()).toHaveLength(1);
  });
});

test.describe("/staff/walk-in · step 2 (confirm the visit)", () => {
  test("visit type, discount and medical certificate are saved on the booking", async ({ as, api, tag, cleanup }) => {
    const { name, staff } = await seedPatient({ api, tag, cleanup }, "wi-opts");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await pickPatient(page, name);
    const followUp = page.getByRole("radio", { name: "Follow-up" });
    await followUp.click();
    await expect(followUp).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: "New visit" })).toHaveAttribute("aria-checked", "false");
    await page.getByLabel("Discount").selectOption("PWD");
    await page.getByRole("checkbox", { name: /Medical certificate requested/ }).check();
    await page.getByRole("button", { name: "Check in and get queue number" }).click();
    await expect(page.getByRole("heading", { name: /is checked in/ })).toBeVisible();
    const [entry] = await queueFor(staff, name);
    const b = await getBooking(staff, entry.booking_id);
    expect(b).toMatchObject({ visit_type: "FollowUp", discount_category: "PWD", med_cert_requested: true });
  });

  test("a patient aged 60+ gets the Senior discount pre-selected", async ({ as, api, tag, cleanup }) => {
    const { name } = await seedPatient({ api, tag, cleanup }, "wi-senior", { date_of_birth: "1950-03-04" });
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await pickPatient(page, name);
    await expect(page.getByLabel("Discount")).toHaveValue("Senior");
    await expect(page.getByText("Set automatically: patient is 60 or older.")).toBeVisible();
  });

  test("Back returns to step 1 with the patient still selected", async ({ as, api, tag, cleanup }) => {
    const { name } = await seedPatient({ api, tag, cleanup }, "wi-back");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await pickPatient(page, name);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Who is checking in?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  test("ticket: 'Next walk-in' resets the wizard; 'Print slip' opens a slip with the queue number", async ({ as, api, tag, cleanup }) => {
    const { name, staff } = await seedPatient({ api, tag, cleanup }, "wi-next");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await pickPatient(page, name);
    await page.getByRole("button", { name: "Check in and get queue number" }).click();
    await expect(page.getByRole("heading", { name: /is checked in/ })).toBeVisible();
    const [entry] = await queueFor(staff, name);
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Print slip" }).click()]);
    await popup.waitForLoadState();
    await expect(popup.locator("body")).toContainText(entry.queue_number);
    await popup.close().catch(() => undefined);
    await page.getByRole("button", { name: "Next walk-in" }).click();
    await expect(page.getByRole("heading", { name: "Who is checking in?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("double-click on 'Check in' makes exactly one queue entry (B5)", async ({ as, api, tag, cleanup }) => {
    const { name, staff } = await seedPatient({ api, tag, cleanup }, "wi-dbl");
    const page = await as("staff");
    await page.goto("/staff/walk-in");
    await pickPatient(page, name);
    await page.getByRole("button", { name: "Check in and get queue number" }).dblclick();
    await expect(page.getByRole("heading", { name: /is checked in/ })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await queueFor(staff, name)).toHaveLength(1);
  });
});

test.describe("walk-in · API rules", () => {
  test("fee matrix: New ₱450, Follow-up ₱350, med-cert +₱50, Senior/PWD ₱400", async ({ api, tag, cleanup }) => {
    const { staff, p } = await seedPatient({ api, tag, cleanup }, "fee");
    const due = async (o: Parameters<typeof checkInWalkIn>[2]) => {
      const t = await checkInWalkIn(staff, p.patient_id, o);
      cleanup(() => cancelQueueEntry(staff, t.booking_id));
      return (await getBooking(staff, t.booking_id)).amount_due as number;
    };
    expect.soft(await due({}), "New").toBe(450);
    expect.soft(await due({ visit_type: "FollowUp" }), "Follow-up").toBe(350);
    expect.soft(await due({ med_cert_requested: true }), "New + med cert").toBe(500);
    expect.soft(await due({ discount_category: "Senior" }), "New + Senior").toBe(400);
    expect.soft(await due({ discount_category: "PWD" }), "New + PWD").toBe(400);
  });

  // BUG-12
  test("a Senior/PWD discount never makes a follow-up cost more than without it", async ({ api, tag, cleanup }) => {
    test.fail(true, "BUG-12: Senior/PWD is a flat ₱400, so on a ₱350 follow-up the 'discount' RAISES the fee to ₱400");
    const { staff, p } = await seedPatient({ api, tag, cleanup }, "fee-fu");
    const a = await checkInWalkIn(staff, p.patient_id, { visit_type: "FollowUp" });
    const b = await checkInWalkIn(staff, p.patient_id, { visit_type: "FollowUp", discount_category: "PWD" });
    cleanup(() => cancelQueueEntry(staff, a.booking_id));
    cleanup(() => cancelQueueEntry(staff, b.booking_id));
    const plain = (await getBooking(staff, a.booking_id)).amount_due as number;
    const disc = (await getBooking(staff, b.booking_id)).amount_due as number;
    expect(disc).toBeLessThanOrEqual(plain);
  });

  // BUG-13
  test("a patient who is already in today's queue cannot be checked in a second time", async ({ api, tag, cleanup }) => {
    test.fail(true, "BUG-13: the same patient can be checked in again while still waiting — two queue numbers, two fees");
    const { staff, p } = await seedPatient({ api, tag, cleanup }, "dupe");
    const first = await checkInWalkIn(staff, p.patient_id);
    cleanup(() => cancelQueueEntry(staff, first.booking_id));
    const res = await staff.post("/api/queue", { data: { patient_id: p.patient_id, visit_type: "New", med_cert_requested: false, discount_category: null } });
    if (res.ok()) cleanup(async () => cancelQueueEntry(staff, (await res.json()).booking_id));
    expect(res.status()).toBe(409);
  });

  test("five simultaneous check-ins all succeed with five different queue numbers", async ({ api, tag, cleanup }) => {
    test.fail(true, "BUG-16: concurrent walk-in check-ins can fail with HTTP 500 'Could not allocate a queue number after multiple attempts'");
    const staff = await api("staff");
    const patients = await Promise.all([1, 2, 3, 4, 5].map((i) => createTaggedPatient(staff, tag(`par${i}`))));
    const results = await Promise.all(
      patients.map((p) => staff.post("/api/queue", { data: { patient_id: p.patient_id, visit_type: "New", med_cert_requested: false, discount_category: null } })),
    );
    const bodies = await Promise.all(results.map((r) => r.json().catch(() => ({}))));
    for (const b of bodies) if (b.booking_id) cleanup(() => cancelQueueEntry(staff, b.booking_id));
    expect(results.map((r) => r.status())).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(bodies.map((b) => b.queue_number)).size).toBe(5);
  });

  test("patient role cannot check anyone in; anonymous gets 401", async ({ api, tag, cleanup }) => {
    const { p } = await seedPatient({ api, tag, cleanup }, "perm");
    const pt = await api("patient");
    const res = await pt.post("/api/queue", { data: { patient_id: p.patient_id, visit_type: "New" } });
    expect(res.status()).toBe(403);
    const anon = await request.newContext({ baseURL: BE_URL });
    expect((await anon.post("/api/queue", { data: { patient_id: p.patient_id, visit_type: "New" } })).status()).toBe(401);
    await anon.dispose();
  });
});

test.describe("/staff/queue", () => {
  const rowOf = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name, "i") });

  test("summary tiles match the API summary and the list shows a new walk-in", async ({ as, api, tag, cleanup }) => {
    const { name, p, staff } = await seedPatient({ api, tag, cleanup }, "q-sum");
    const t = await checkInWalkIn(staff, p.patient_id);
    const page = await as("staff");
    await page.goto("/staff/queue");
    await expect(rowOf(page, name)).toBeVisible();
    await expect(rowOf(page, name)).toContainText(t.queue_number);
    await expect(rowOf(page, name)).toContainText("Checked in");
    await expect(rowOf(page, name)).toContainText("Walk-in");
    const { summary } = await getQueue(staff);
    const tile = (label: string) => page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=..").locator("dd");
    await expect.soft(tile("Waiting")).toHaveText(String(summary.waiting));
    await expect.soft(tile("With doctor")).toHaveText(String(summary.in_progress));
    await expect.soft(tile("Booked, not arrived")).toHaveText(String(summary.booked));
    await expect.soft(tile("Completed")).toHaveText(String(summary.completed));
    await expect.soft(tile("Total today")).toHaveText(String(summary.total));
  });

  test("Hold → Call in → Complete walks one patient through the queue and the API agrees at each step", async ({ as, api, tag, cleanup }) => {
    const { name, p, staff } = await seedPatient({ api, tag, cleanup }, "q-flow");
    const t = await checkInWalkIn(staff, p.patient_id);
    const page = await as("staff");
    await page.goto("/staff/queue");
    const status = async () => (await queueFor(staff, name))[0].status;
    await rowOf(page, name).getByRole("button", { name: "Hold" }).click();
    await expect.poll(status).toBe("OnHold");
    await rowOf(page, name).getByRole("button", { name: "Call in" }).click();
    await expect.poll(status).toBe("InProgress");
    await expect(rowOf(page, name).getByRole("link", { name: "Open consult" })).toHaveAttribute("href", `/doctor/consultation/${t.booking_id}`);
    await rowOf(page, name).getByRole("button", { name: "Complete" }).click();
    await expect.poll(status).toBe("Completed");
    cleanup(() => undefined);
  });

  test("No-show marks the patient as a no-show", async ({ as, api, tag, cleanup }) => {
    const { name, p, staff } = await seedPatient({ api, tag, cleanup }, "q-ns");
    await checkInWalkIn(staff, p.patient_id);
    const page = await as("staff");
    await page.goto("/staff/queue");
    await rowOf(page, name).getByRole("button", { name: "No-show" }).click();
    await expect.poll(async () => (await queueFor(staff, name))[0].status).toBe("NoShow");
  });

  test("Cancel needs a reason; 'Keep booking' changes nothing; confirming removes the patient from the queue", async ({ as, api, tag, cleanup }) => {
    const { name, p, staff } = await seedPatient({ api, tag, cleanup }, "q-can");
    const t = await checkInWalkIn(staff, p.patient_id);
    const page = await as("staff");
    await page.goto("/staff/queue");
    await rowOf(page, name).getByRole("button", { name: "Cancel" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Cancel ${t.queue_number}`);
    await dialog.getByRole("button", { name: "Cancel booking" }).click(); // empty reason
    await expect(dialog.getByText("Please enter a reason.")).toBeVisible();
    await dialog.getByRole("button", { name: "Keep booking" }).click();
    await expect(dialog).toBeHidden();
    expect((await queueFor(staff, name))[0].status).toBe("CheckedIn");
    await rowOf(page, name).getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog").getByLabel("Reason").fill("E2E patient left");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).dblclick();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(rowOf(page, name)).toHaveCount(0);
    expect((await getBooking(staff, t.booking_id)).status).toBe("Cancelled");
  });

  test("an online booking (Pending) shows Check in / No-show; Check in moves it to the waiting list", async ({ as, api, tag, cleanup }) => {
    const { registerFreshPatient, bookOnline, manilaDate } = await import("../support/api");
    const staff = await api("staff");
    const me = await registerFreshPatient(tag("q-pend"));
    cleanup(() => me.dispose());
    const { body, status } = await bookOnline(me.api, manilaDate());
    expect([200, 201]).toContain(status);
    cleanup(() => cancelQueueEntry(staff, body.booking_id));
    const page = await as("staff");
    await page.goto("/staff/queue");
    const row = rowOf(page, me.firstName);
    await expect(row).toContainText("Booked online");
    await expect(row.getByRole("button", { name: "No-show" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await row.getByRole("button", { name: "Check in" }).click();
    await expect(row.getByRole("button", { name: "Call in" })).toBeVisible();
    expect((await getBooking(staff, body.booking_id)).status).toBe("CheckedIn");
  });

  test("the patient name links to the booking detail page", async ({ as, api, tag, cleanup }) => {
    const { name, fullName, p, staff } = await seedPatient({ api, tag, cleanup }, "q-link");
    const t = await checkInWalkIn(staff, p.patient_id);
    const page = await as("staff");
    await page.goto("/staff/queue");
    await page.getByRole("link", { name: new RegExp(fullName, "i") }).click();
    await expect(page).toHaveURL(new RegExp(`/staff/bookings/${t.booking_id}`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(fullName);
    void name;
  });

  test("API: cancelling a queue entry without a reason is rejected", async ({ api, tag, cleanup }) => {
    const { staff, p } = await seedPatient({ api, tag, cleanup }, "q-api");
    const t = await checkInWalkIn(staff, p.patient_id);
    cleanup(() => cancelQueueEntry(staff, t.booking_id));
    expect((await staff.put(`/api/queue/${t.booking_id}/cancel`, { data: { reason: "" } })).status()).toBe(400);
  });

  test("API: a patient cannot be completed before being called in", async ({ api, tag, cleanup }) => {
    test.fail(true, "BUG-17: PUT /api/queue/{id}/complete succeeds on a CheckedIn patient who never saw the doctor (UI only offers Complete while With doctor)");
    const { staff, p } = await seedPatient({ api, tag, cleanup }, "q-api2");
    const t = await checkInWalkIn(staff, p.patient_id);
    cleanup(() => cancelQueueEntry(staff, t.booking_id));
    const early = await staff.put(`/api/queue/${t.booking_id}/complete`);
    expect(early.status()).toBeGreaterThanOrEqual(400);
  });
});
