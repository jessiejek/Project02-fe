import { test, expect } from "../support/fixtures";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  createAnnouncement, createTaggedPatient, deleteAnnouncementsByTitle, deleteStaffByEmail, getDoctor, patientsMatching, staffAccountByEmail,
} from "../support/api";

/** COVERAGE-PLAN §3 · Admin: doctors, staff team, patients, announcements */

async function doctorSnapshot(api: APIRequestContext) {
  const d = await getDoctor(api);
  return { d, acct: d.staff_accounts };
}
async function restoreDoctor(admin: APIRequestContext, s: Awaited<ReturnType<typeof doctorSnapshot>>) {
  await admin.put(`/api/doctors/${s.d.doctor_id}`, { data: s.d });
  await admin.put(`/api/staff-accounts/${s.d.doctor_id}`, { data: s.acct });
}
/** Count PUT/POST requests to a path while `fn` runs. */
async function countRequests(page: Page, method: string, pathRe: RegExp, fn: () => Promise<void>) {
  let n = 0;
  const on = (r: import("@playwright/test").Request) => { if (r.method() === method && pathRe.test(r.url())) n++; };
  page.on("request", on);
  await fn();
  await page.waitForTimeout(1200);
  page.off("request", on);
  return n;
}

test.describe("/admin/doctors", () => {
  test("list shows the doctor with Edit and Deactivate; Edit opens the edit form", async ({ as, api }) => {
    const admin = await api("admin");
    const d = await getDoctor(admin);
    const page = await as("admin");
    await page.goto("/admin/doctors");
    await expect(page.getByRole("heading", { name: "Doctors", level: 1 })).toBeVisible();
    await expect(page.getByText(d.staff_accounts.full_name).locator("visible=true").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/doctors/${d.doctor_id}/edit`));
  });

  test("Deactivate: 'Keep active' changes nothing; confirming marks the doctor Inactive (and Reactivate puts it back)", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const s = await doctorSnapshot(admin);
    cleanup(() => restoreDoctor(admin, s));
    const page = await as("admin");
    await page.goto("/admin/doctors");
    await page.getByRole("button", { name: "Deactivate" }).first().click();
    const dlg = page.getByRole("dialog", { name: /Deactivate/ });
    await expect(dlg.getByText(/no longer appear in patient-facing booking/)).toBeVisible();
    await dlg.getByRole("button", { name: "Keep active" }).click();
    await expect(dlg).toHaveCount(0);
    expect((await getDoctor(admin)).staff_accounts.status).toBe("Active");
    // confirm (click once)
    await page.getByRole("button", { name: "Deactivate" }).first().click();
    await page.getByRole("dialog", { name: /Deactivate/ }).getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect.poll(async () => (await getDoctor(admin)).staff_accounts.status).toBe("Inactive");
    await page.reload();
    await expect(page.getByText("Inactive").locator("visible=true").first()).toBeVisible();
    // reactivate through the UI if a button exists, else rely on cleanup
    const re = page.getByRole("button", { name: /Reactivate|Activate/ }).locator("visible=true").first();
    if (await re.isVisible().catch(() => false)) {
      await re.click();
      const confirm = page.getByRole("dialog").getByRole("button", { name: /Reactivate|Activate|Confirm/ });
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await expect.poll(async () => (await getDoctor(admin)).staff_accounts.status).toBe("Active");
    }
  });

  test("edit: change every practice field → save → reload keeps them → API agrees", async ({ as, api, cleanup, tag }) => {
    const admin = await api("admin");
    const s = await doctorSnapshot(admin);
    cleanup(() => restoreDoctor(admin, s));
    const spec = tag("spec");
    const page = await as("admin");
    await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
    await page.getByLabel("Specialty").fill(spec);
    await page.getByLabel("Consultation fee (₱)").fill("475");
    await page.getByLabel("Slot duration (minutes)").fill("20");
    await page.getByLabel("Bio (shown to patients)").fill(`${spec} bio`);
    await page.getByLabel("PRC license number").fill("PRC-123456");
    await page.getByLabel("PTR number").fill("PTR-654321");
    await page.getByLabel("S2 number").fill("S2-111");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(async () => (await getDoctor(admin)).specialization).toBe(spec);
    const d = await getDoctor(admin);
    expect(d).toMatchObject({ consultation_fee: 475, slot_duration_minutes: 20, license_number: "PRC-123456", ptr_number: "PTR-654321", s2_number: "S2-111" });
    await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
    await expect(page.getByLabel("Specialty")).toHaveValue(spec);
    await expect(page.getByLabel("Consultation fee (₱)")).toHaveValue("475");
    await expect(page.getByLabel("PRC license number")).toHaveValue("PRC-123456");
  });

  test("edit: Cancel leaves the doctor unchanged", async ({ as, api }) => {
    const admin = await api("admin");
    const before = await getDoctor(admin);
    const page = await as("admin");
    await page.goto(`/admin/doctors/${before.doctor_id}/edit`);
    await page.getByLabel("Specialty").fill("E2E should not be saved");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/admin\/doctors$/);
    expect((await getDoctor(admin)).specialization).toBe(before.specialization);
  });

  test("edit: empty full name / empty specialty / bad fee / bad slot are blocked (Save disabled) or not stored", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const s = await doctorSnapshot(admin);
    cleanup(() => restoreDoctor(admin, s));
    const page = await as("admin");
    const tryField = async (label: string, value: string) => {
      await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
      await page.getByLabel(label).fill(value);
      const save = page.getByRole("button", { name: "Save changes" });
      if (await save.isDisabled()) return { blocked: true, d: await getDoctor(admin) };
      await save.click();
      await page.waitForTimeout(1200);
      return { blocked: false, d: await getDoctor(admin) };
    };
    const a = await tryField("Full name", "");
    expect(a.d.staff_accounts.full_name, "empty full name must not be stored").toBe(s.acct.full_name);
    const b = await tryField("Specialty", "");
    expect(b.d.specialization, "empty specialty must not be stored").toBe(s.d.specialization);
  });

  test("edit: a negative consultation fee is not stored", async ({ as, api, cleanup }) => {
    test.fail(true, "BUG-31: /admin/doctors/{id}/edit accepts and stores a negative consultation fee (-50)");
    const admin = await api("admin");
    const s = await doctorSnapshot(admin);
    cleanup(() => restoreDoctor(admin, s));
    const page = await as("admin");
    await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
    await page.getByLabel("Consultation fee (₱)").fill("-50");
    const save = page.getByRole("button", { name: "Save changes" });
    if (await save.isEnabled()) { await save.click(); await page.waitForTimeout(1200); }
    expect((await getDoctor(admin)).consultation_fee).toBe(s.d.consultation_fee);
  });

  test("edit: a 0-minute slot duration is not stored", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const s = await doctorSnapshot(admin);
    cleanup(() => restoreDoctor(admin, s));
    const page = await as("admin");
    await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
    await page.getByLabel("Slot duration (minutes)").fill("0");
    const save = page.getByRole("button", { name: "Save changes" });
    if (await save.isEnabled()) { await save.click(); await page.waitForTimeout(1200); }
    expect((await getDoctor(admin)).slot_duration_minutes).toBe(s.d.slot_duration_minutes);
  });

  test("edit: double-submit (click AND Enter) sends one save", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const s = await doctorSnapshot(admin);
    cleanup(() => restoreDoctor(admin, s));
    const page = await as("admin");
    await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
    await page.getByLabel("Bio (shown to patients)").fill("E2E double submit bio");
    const n = await countRequests(page, "PUT", /\/api\/doctors\/[0-9a-f-]+$/, async () => {
      await page.getByRole("button", { name: "Save changes" }).dblclick();
    });
    expect(n, "PUT /api/doctors/{id} calls after a double-click").toBe(1);
    await page.goto(`/admin/doctors/${s.d.doctor_id}/edit`);
    await page.getByLabel("Bio (shown to patients)").fill("E2E enter submit bio");
    const m = await countRequests(page, "PUT", /\/api\/doctors\/[0-9a-f-]+$/, async () => {
      await page.getByLabel("Bio (shown to patients)").press("Enter");
      await page.getByRole("button", { name: "Save changes" }).click();
    });
    expect(m, "PUT /api/doctors/{id} calls after Enter + click").toBeLessThanOrEqual(1);
  });

  test("new doctor form: 'Send invite' stays disabled until valid; Cancel returns to the list; nothing is created", async ({ as, api, tag }) => {
    const admin = await api("admin");
    const before = (await (await admin.get("/api/staff-accounts")).json()).length;
    const page = await as("admin");
    await page.goto("/admin/doctors/new");
    const send = page.getByRole("button", { name: "Send invite" });
    await expect(send).toBeDisabled();
    await page.getByLabel("Full name").fill(`Dr ${tag("nd")}`);
    await expect(send).toBeDisabled();
    await page.getByLabel("Email").fill("not-an-email");
    await expect(send).toBeDisabled();
    await page.getByLabel("Email").fill(`${tag("nd").toLowerCase()}@example.test`);
    await page.getByLabel("Specialty").fill("Pediatrics");
    await page.getByLabel("Consultation fee (₱)").fill("500");
    await expect(send).toBeEnabled();
    await page.getByLabel("Consultation fee (₱)").fill("");
    await expect(send, "empty fee").toBeDisabled();
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/admin\/doctors$/);
    expect((await (await admin.get("/api/staff-accounts")).json()).length).toBe(before);
  });
});

test.describe("/admin/staff", () => {
  test("invite: required fields, bad e-mail, double-submit = one invite, appears as 'Invited', Revoke removes it", async ({ as, api, tag, cleanup, guard }) => {
    guard.allow(/\/api\/auth\/invite/); // second submit of the same e-mail may legitimately be refused
    const admin = await api("admin");
    const name = tag("inv");
    const email = `${name.toLowerCase()}@example.test`;
    cleanup(() => deleteStaffByEmail(admin, email));
    const page = await as("admin");
    await page.goto("/admin/staff");
    const send = page.getByRole("button", { name: "Send invite" });
    await expect(send).toBeDisabled();
    await page.getByLabel("Full name").fill(name);
    await expect(send, "name only").toBeDisabled();
    await page.getByLabel("Email").fill("nope");
    if (await send.isEnabled()) {
      await send.click();
      await page.waitForTimeout(1200);
      expect(await staffAccountByEmail(admin, "nope"), "an invalid e-mail must not create an invite").toBeUndefined();
    }
    await page.getByLabel("Email").fill("");
    await page.getByLabel("Full name").fill("");
    await page.getByLabel("Email").fill(email);
    await expect(send, "e-mail only").toBeDisabled();
    await page.getByLabel("Full name").fill(name);
    await expect(send).toBeEnabled();
    await send.dblclick();
    const row = page.getByRole("row", { name: new RegExp(name, "i") });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Invited");
    const rows: any[] = await (await admin.get("/api/staff-accounts")).json();
    expect(rows.filter((r) => r.email.toLowerCase() === email), "invites stored").toHaveLength(1);
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(name, "i") })).toHaveCount(1);
    await page.getByRole("row", { name: new RegExp(name, "i") }).getByRole("button", { name: "Revoke invite" }).click();
    const dlg = page.getByRole("dialog");
    if (await dlg.isVisible().catch(() => false)) await dlg.getByRole("button", { name: /Revoke/ }).last().click();
    await expect.poll(async () => (await staffAccountByEmail(admin, email))?.status ?? "gone").not.toBe("Invited");
  });

  test("an invited account cannot log in yet", async ({ api, tag, cleanup }) => {
    const admin = await api("admin");
    const email = `${tag("inv2").toLowerCase()}@example.test`;
    cleanup(() => deleteStaffByEmail(admin, email));
    const res = await admin.post("/api/auth/invite", { data: { email, fullName: tag("inv2"), role: "Staff" } });
    expect(res.ok()).toBeTruthy();
    const login = await admin.post("/api/auth/login", { data: { email, password: "E2e-Passw0rd!" }, headers: { Authorization: "" } });
    expect(login.ok()).toBeFalsy();
  });

  //JJQR - AI (Nov 20, 2026) - B-32 fixed: marker removed. Uses the spare dev staff login (spare-staff@) so the shared staff@ login that other specs
  // rely on is never deactivated (the server now rejects a deactivated account's tokens immediately).
  test("a deactivated staff member cannot sign in, and their existing session stops working", async ({ api, cleanup }) => {
    const admin = await api("admin");
    const me = (await staffAccountByEmail(admin, "spare-staff@clinic.test"))!;
    cleanup(async () => { await admin.put(`/api/staff-accounts/${me.staff_id}`, { data: { ...me, status: me.status } }); });
    await admin.put(`/api/staff-accounts/${me.staff_id}`, { data: { ...me, status: "Active" } });
    const ok = await admin.post("/api/auth/login", { data: { email: "spare-staff@clinic.test", password: "ClinicDev123!" }, headers: { Authorization: "" } });
    expect(ok.ok(), "an active account can log in").toBeTruthy();
    const session = await ok.json();
    await admin.put(`/api/staff-accounts/${me.staff_id}`, { data: { ...me, status: "Inactive" } });
    const login = await admin.post("/api/auth/login", { data: { email: "spare-staff@clinic.test", password: "ClinicDev123!" }, headers: { Authorization: "" } });
    expect(login.ok(), "an inactive staff member must not be able to log in").toBeFalsy();
    expect(login.status()).toBe(403);
    const withOldToken = await admin.get("/api/auth/me", { headers: { Authorization: `Bearer ${session.accessToken}` } });
    expect(withOldToken.status(), "the old access token stops working at once").toBe(401);
  });
  //JJQR - END

  test("team table lists a staff account; Deactivate (immediate, no confirm) → Inactive; Activate restores", async ({ as, api, cleanup }) => {
    const admin = await api("admin");
    const email = "spare-staff@clinic.test"; // spare dev account (seeded by DevDataSeeder) nothing else logs in with
    const me = (await staffAccountByEmail(admin, email))!;
    cleanup(async () => { await admin.put(`/api/staff-accounts/${me.staff_id}`, { data: { ...me, status: me.status } }); });
    await admin.put(`/api/staff-accounts/${me.staff_id}`, { data: { ...me, status: "Active" } });
    const page = await as("admin");
    await page.goto("/admin/staff");
    const row = page.getByRole("row", { name: new RegExp(email.replace(".", "\\.")) });
    await expect(row).toContainText("Active");
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect.poll(async () => (await staffAccountByEmail(admin, email))?.status).toBe("Inactive");
    await expect(row).toContainText("Inactive");
    await page.reload();
    await row.getByRole("button", { name: "Activate" }).click();
    await expect.poll(async () => (await staffAccountByEmail(admin, email))?.status).toBe("Active");
    await page.reload();
    await expect(row).toContainText("Active");
  });
});

test.describe("/admin/patients", () => {
  test("search by name / code; empty result; paging counter and Next/Previous", async ({ as, api, tag }) => {
    const admin = await api("admin");
    const name = tag("ap");
    const p = await createTaggedPatient(admin, name);
    const page = await as("admin");
    await page.goto("/admin/patients");
    const box = page.getByRole("searchbox", { name: "Search patients" });
    await box.fill(name);
    await expect(page.getByRole("row", { name: new RegExp(name, "i") })).toHaveCount(1);
    await box.fill(p.patient_code);
    await expect(page.getByRole("row", { name: new RegExp(name, "i") })).toHaveCount(1);
    await box.fill(`zz-nobody-${tag("n")}`);
    await expect(page.getByRole("row", { name: /MF-/ })).toHaveCount(0);
    await box.fill("");
    const nav = page.getByRole("navigation", { name: "Patient pages" });
    await expect(nav).toBeVisible();
    await expect(nav).toContainText(/1.{1,3}25 of \d+/);
    await nav.getByRole("button", { name: /Next/ }).click();
    await expect(nav).toContainText(/26.{1,3}\d+ of \d+/);
    await nav.getByRole("button", { name: /Prev/ }).click();
    await expect(nav).toContainText(/1.{1,3}25 of \d+/);
  });

  test("Add patient: disabled until valid, Cancel creates nothing, double-submit creates one, row opens detail", async ({ as, api, tag }) => {
    const admin = await api("admin");
    const first = tag("add");
    const page = await as("admin");
    await page.goto("/admin/patients");
    await page.getByRole("button", { name: "Add patient" }).first().click();
    const dlg = page.getByRole("dialog", { name: "Add a patient" });
    const add = dlg.getByRole("button", { name: "Add patient" });
    await expect(add).toBeDisabled();
    await dlg.getByLabel("First name").fill(first);
    await expect(add, "first name only").toBeDisabled();
    await dlg.getByLabel("Last name").fill("Tester");
    await expect(add, "no DOB").toBeDisabled();
    await dlg.getByLabel("Date of birth").fill("1991-02-03");
    await expect(add, "no sex chosen").toBeDisabled();
    await dlg.getByLabel("Sex").selectOption("Female");
    await expect(add).toBeEnabled();
    await dlg.getByLabel("Date of birth").fill("2999-01-01");
    await dlg.getByLabel("Date of birth").fill("1991-02-03");
    // Cancel path
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toHaveCount(0);
    expect(await patientsMatching(admin, first), "cancel creates nothing").toHaveLength(0);
    // happy path with double click
    await page.getByRole("button", { name: "Add patient" }).first().click();
    await dlg.getByLabel("First name").fill(first);
    await dlg.getByLabel("Last name").fill("Tester");
    await dlg.getByLabel("Date of birth").fill("1991-02-03");
    await dlg.getByLabel("Sex").selectOption("Female");
    await dlg.getByLabel("Contact number").fill("09171230000");
    await dlg.getByRole("button", { name: "Add patient" }).dblclick();
    await page.waitForTimeout(1500);
    const found = await patientsMatching(admin, first);
    expect(found, "double-click must create exactly one patient").toHaveLength(1);
    expect(found[0]).toMatchObject({ date_of_birth: "1991-02-03" });
  });

  test("Add patient: a date of birth in the future is refused", async ({ as, api, tag }) => {
    test.fail(true, "BUG-33: 'Add patient' accepts a date of birth in the future (2999-01-01) typed into the date field (max= is only a hint) and creates the patient");
    const admin = await api("admin");
    const first = tag("fut");
    const page = await as("admin");
    await page.goto("/admin/patients");
    await page.getByRole("button", { name: "Add patient" }).first().click();
    const dlg = page.getByRole("dialog", { name: "Add a patient" });
    await dlg.getByLabel("First name").fill(first);
    await dlg.getByLabel("Last name").fill("Tester");
    await dlg.getByLabel("Date of birth").fill("2999-01-01");
    await dlg.getByLabel("Sex").selectOption("Male");
    const add = dlg.getByRole("button", { name: "Add patient" });
    if (await add.isEnabled()) { await add.click(); await page.waitForTimeout(1500); }
    expect(await patientsMatching(admin, first), "a patient born in 2999 must not be created").toHaveLength(0);
  });

  test("patient detail: tabs, Edit details required-field message, Cancel = no change, save persists after reload", async ({ as, api, tag }) => {
    const admin = await api("admin");
    const name = tag("ed");
    const p = await createTaggedPatient(admin, name);
    const page = await as("admin");
    await page.goto(`/admin/patients/${p.patient_id}`);
    await expect(page.getByRole("heading", { name: new RegExp(name, "i") }).first()).toBeVisible();
    for (const t of [/Overview/, /Bookings/, /Consultations/]) await expect(page.getByRole("tab", { name: t })).toBeVisible();
    await page.getByRole("button", { name: "Edit details" }).click();
    const dlg = page.getByRole("dialog", { name: "Edit patient details" });
    await dlg.getByLabel("First name").fill("");
    await dlg.getByRole("button", { name: "Save changes" }).click();
    await expect(dlg.getByText("First name, last name, and date of birth are required.")).toBeVisible();
    await dlg.getByLabel("First name").fill(name);
    await dlg.getByLabel("Last name").fill("");
    await dlg.getByRole("button", { name: "Save changes" }).click();
    await expect(dlg.getByText("First name, last name, and date of birth are required.")).toBeVisible();
    // cancel
    await dlg.getByLabel("Last name").fill("ShouldNotStick");
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("ShouldNotStick")).toHaveCount(0);
    // save
    await page.getByRole("button", { name: "Edit details" }).click();
    await dlg.getByLabel("Contact number").fill("09179998888");
    await dlg.getByLabel("Last name").fill("Renamed");
    await dlg.getByRole("button", { name: "Save changes" }).dblclick();
    await expect(dlg).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Renamed").first()).toBeVisible();
    await expect(page.getByText("09179998888").first()).toBeVisible();
  });

  test("patient detail with an unknown id shows a not-found state, not a crash", async ({ as, guard }) => {
    guard.allow(/\/api\/patients\//);
    const page = await as("admin");
    await page.goto("/admin/patients/00000000-0000-0000-0000-000000000001");
    await expect(page.getByText(/not found|couldn't|could not|doesn't exist/i).first()).toBeVisible();
  });
});

test.describe("/admin/announcements", () => {
  test("create → shown → edit → hide (switch) → delete with 'Keep it' then Delete", async ({ as, api, tag, cleanup }) => {
    const admin = await api("admin");
    const title = tag("ann");
    cleanup(() => deleteAnnouncementsByTitle(admin, title));
    const page = await as("admin");
    await page.goto("/admin/announcements");
    await page.getByRole("button", { name: "New announcement" }).first().click();
    const dlg = page.getByRole("dialog", { name: "New announcement" });
    const post = dlg.getByRole("button", { name: "Post announcement" });
    await expect(post).toBeDisabled();
    await dlg.getByLabel("Title").fill(title);
    await expect(post, "title only").toBeDisabled();
    await dlg.getByLabel("Message").fill("Clinic closed Friday");
    await expect(post).toBeEnabled();
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toHaveCount(0);
    expect(((await (await admin.get("/api/announcements?activeOnly=false")).json()) as any[]).filter((a) => a.title === title)).toHaveLength(0);
    // double-click post → one
    await page.getByRole("button", { name: "New announcement" }).first().click();
    await dlg.getByLabel("Title").fill(title);
    await dlg.getByLabel("Message").fill("Clinic closed Friday");
    await post.dblclick();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(1);
    expect(((await (await admin.get("/api/announcements?activeOnly=false")).json()) as any[]).filter((a) => a.title === title), "B5 double submit").toHaveLength(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(1);
    // edit
    const item = page.getByRole("listitem").filter({ hasText: title });
    await item.getByRole("button", { name: "Edit" }).click();
    const ed = page.getByRole("dialog", { name: "Edit announcement" });
    await ed.getByLabel("Message").fill("Clinic closed Saturday");
    await ed.getByRole("button", { name: "Save changes" }).click();
    await expect(item.getByText("Clinic closed Saturday")).toBeVisible();
    // hide with the switch
    const sw = item.getByRole("switch", { name: /Show/ });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect.poll(async () => ((await (await admin.get("/api/announcements?activeOnly=false")).json()) as any[]).find((a) => a.title === title)?.is_active).toBe(false);
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: title }).getByRole("switch")).not.toBeChecked();
    // delete: keep then delete
    await item.getByRole("button", { name: "Delete" }).click();
    const del = page.getByRole("dialog", { name: "Delete announcement?" });
    await del.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(1);
    await item.getByRole("button", { name: "Delete" }).click();
    await del.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
    expect(((await (await admin.get("/api/announcements?activeOnly=false")).json()) as any[]).filter((a) => a.title === title)).toHaveLength(0);
  });

  test("staff see an active announcement (not a hidden one) on /staff/announcements", async ({ as, api, tag, cleanup }) => {
    const admin = await api("admin");
    const shown = tag("annA");
    const hidden = tag("annB");
    cleanup(() => deleteAnnouncementsByTitle(admin, "E2E-"));
    await createAnnouncement(admin, shown, "visible body", true);
    await createAnnouncement(admin, hidden, "hidden body", false);
    const page = await as("staff");
    await page.goto("/staff/announcements");
    await expect(page.getByRole("heading", { name: shown })).toBeVisible();
    await expect(page.getByText(hidden)).toHaveCount(0);
  });

  test("patients see an active announcement on their dashboard (admin copy: 'shown on the patient and staff dashboards')", async ({ as, api, tag, cleanup }) => {
    test.fail(true, "BUG-30: no patient page (and no staff/patient dashboard) ever loads announcements — only /staff/announcements does, although the admin page says they are shown on the patient and staff dashboards");
    const admin = await api("admin");
    const shown = tag("annP");
    cleanup(() => deleteAnnouncementsByTitle(admin, "E2E-"));
    await createAnnouncement(admin, shown, "for patients", true);
    const page = await as("patient");
    await page.goto("/patient/dashboard");
    await expect(page.getByText(shown).first()).toBeVisible({ timeout: 5000 });
  });

  test("New announcement: a whitespace-only title or message cannot be posted", async ({ as }) => {
    const page = await as("admin");
    await page.goto("/admin/announcements");
    await page.getByRole("button", { name: "New announcement" }).first().click();
    const dlg = page.getByRole("dialog", { name: "New announcement" });
    await dlg.getByLabel("Title").fill("   ");
    await dlg.getByLabel("Message").fill("   ");
    await expect(dlg.getByRole("button", { name: "Post announcement" })).toBeDisabled();
  });
});
