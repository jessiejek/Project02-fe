import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";
import { getPaymentForBooking, manilaDate, registerFreshPatient, type FreshPatient } from "../support/api";
import { completeVisitViaApi, type CompletedVisit } from "../support/visit";

/** COVERAGE-PLAN §3 · Patient: documents, lab-results (file upload), medical-records, prescriptions, vaccinations, dashboard */

type Fx = { tag: (l?: string) => string; cleanup: (fn: () => unknown) => void };
async function patientWithVisit(fx: Fx, api: (r: "staff" | "doctor") => Promise<any>, label: string, opts: Parameters<typeof completeVisitViaApi>[2] = {}) {
  const me: FreshPatient = await registerFreshPatient(fx.tag(label));
  fx.cleanup(() => me.dispose());
  const visit: CompletedVisit = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId, opts);
  return { me, visit };
}

const PDF = { name: "e2e.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF") };

/** Same upload form on /patient/documents and /patient/lab-results */
for (const [path, noun, submit, listHeading, emptyMsg, textLabel] of [
  ["/patient/documents", "document", "Upload document", /Your documents \(\d+\)/, "No documents yet.", "Title (optional)"],
  ["/patient/lab-results", "lab result", "Upload result", /Uploaded results \(\d+\)/, "No lab results yet.", "Result notes (optional)"],
] as const) {
  test.describe(`${path} · upload`, () => {
    const fileInput = (page: Page) => page.locator('input[type="file"]');

    test("required: Upload stays disabled without a visit or without a file", async ({ loginAs, api, tag, cleanup }) => {
      const { me } = await patientWithVisit({ tag, cleanup }, api, "up1");
      const page = await loginAs(me.email, me.password);
      await page.goto(path);
      const btn = page.getByRole("button", { name: submit });
      await expect(btn).toBeDisabled();
      await fileInput(page).setInputFiles(PDF);
      await expect(btn, "file but no visit").toBeDisabled();
      await fileInput(page).setInputFiles([]);
      await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
      await expect(btn, "visit but no file").toBeDisabled();
      await expect(page.getByText(emptyMsg)).toBeVisible();
    });

    test("happy path: upload a PDF → listed → still listed after reload; the note/title persists", async ({ loginAs, api, tag, cleanup }) => {
      const { me } = await patientWithVisit({ tag, cleanup }, api, "up2");
      const page = await loginAs(me.email, me.password);
      await page.goto(path);
      const note = tag("note");
      await fileInput(page).setInputFiles(PDF);
      await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
      await page.getByLabel(textLabel).fill(note);
      await page.getByRole("button", { name: submit }).click();
      await expect(page.getByText(/uploaded\./i)).toBeVisible();
      await expect(page.getByRole("heading", { name: listHeading })).toContainText("(1)");
      await page.reload();
      await expect(page.getByRole("heading", { name: listHeading })).toContainText("(1)");
      await expect(page.getByText(note).or(page.getByText("e2e.pdf")).first()).toBeVisible();
    });

    for (const [name, mimeType] of [
      ["x.png", "image/png"], ["x.jpg", "image/jpeg"], ["x.webp", "image/webp"], ["x.gif", "image/gif"],
      ["x.doc", "application/msword"], ["x.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ] as const) {
      test(`accepted type ${name}`, async ({ loginAs, api, tag, cleanup }) => {
        const { me } = await patientWithVisit({ tag, cleanup }, api, "ty");
        const page = await loginAs(me.email, me.password);
        await page.goto(path);
        await fileInput(page).setInputFiles({ name, mimeType, buffer: Buffer.from("GIF89a\x01\x00\x01\x00") });
        await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
        await page.getByRole("button", { name: submit }).click();
        await expect(page.getByText(/uploaded\./i), `${name} should be accepted`).toBeVisible();
      });
    }

    test("a disallowed type (.exe / .txt / .html) is refused with a message and nothing is listed", async ({ loginAs, api, tag, cleanup, guard }) => {
      guard.off();
      const { me } = await patientWithVisit({ tag, cleanup }, api, "up3");
      const page = await loginAs(me.email, me.password);
      await page.goto(path);
      for (const f of [
        { name: "evil.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") },
        { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
        { name: "page.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") },
      ]) {
        await fileInput(page).setInputFiles(f);
        await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
        await page.getByRole("button", { name: submit }).click();
        await expect(page.getByRole("alert").filter({ hasText: /\S/ }), `${f.name} should be refused`).toBeVisible();
        await expect(page.getByText(/uploaded\./i)).toHaveCount(0);
      }
      await page.reload();
      await expect(page.getByText(emptyMsg)).toBeVisible();
    });

    test("a file over 10 MB is refused", async ({ loginAs, api, tag, cleanup, guard }) => {
      guard.off();
      const { me } = await patientWithVisit({ tag, cleanup }, api, "up4");
      const page = await loginAs(me.email, me.password);
      await page.goto(path);
      await fileInput(page).setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1024, 0x41) });
      await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
      await page.getByRole("button", { name: submit }).click();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible({ timeout: 30_000 });
      await page.reload();
      await expect(page.getByText(emptyMsg)).toBeVisible();
    });

    test("double submit (click + Enter) stores exactly one file", async ({ loginAs, api, tag, cleanup }) => {
      const { me } = await patientWithVisit({ tag, cleanup }, api, "up5");
      const page = await loginAs(me.email, me.password);
      await page.goto(path);
      await fileInput(page).setInputFiles(PDF);
      await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
      await page.getByRole("button", { name: submit }).click();
      await page.getByLabel("Visit it belongs to").press("Enter").catch(() => undefined);
      await expect(page.getByText(/uploaded\./i)).toBeVisible();
      await page.waitForTimeout(800);
      await page.reload();
      await expect(page.getByRole("heading", { name: listHeading })).toContainText("(1)");
    });

    test("another patient's visit cannot be attached via the API", async ({ api, tag, cleanup, guard }) => {
      guard.off();
      const a = await patientWithVisit({ tag, cleanup }, api, "upA");
      const b = await registerFreshPatient(tag("upB"));
      cleanup(() => b.dispose());
      const endpoint = path === "/patient/documents" ? "/api/patient-documents" : "/api/patient-lab-results";
      // B uploads against A's booking while claiming to be B → refused
      const r1 = await b.api.post(endpoint, { multipart: { file: PDF, patientId: b.patientId, bookingId: a.visit.booking_id } });
      expect(r1.status(), await r1.text()).toBe(400);
      // B uploads on behalf of A → refused
      const r2 = await b.api.post(endpoint, { multipart: { file: PDF, patientId: a.me.patientId, bookingId: a.visit.booking_id } });
      expect(r2.status()).toBe(403);
      // control: the owner can
      const ok = await a.me.api.post(endpoint, { multipart: { file: PDF, patientId: a.me.patientId, bookingId: a.visit.booking_id } });
      expect(ok.status(), await ok.text()).toBe(200);
    });
  });
}

test.describe("/patient/documents · search", () => {
  test("search box appears with documents and filters them", async ({ loginAs, api, tag, cleanup }) => {
    const { me } = await patientWithVisit({ tag, cleanup }, api, "dsearch");
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/documents");
    for (const title of ["alpha-" + tag("t"), "beta-" + tag("t")]) {
      await page.locator('input[type="file"]').setInputFiles(PDF);
      await page.getByLabel("Visit it belongs to").selectOption({ index: 1 });
      await page.getByLabel("Title (optional)").fill(title);
      await page.getByRole("button", { name: "Upload document" }).click();
      await expect(page.getByText("Document uploaded.")).toBeVisible();
      await page.getByText("Document uploaded.").waitFor({ state: "attached" });
    }
    await page.getByLabel("Search documents").fill("alpha-");
    await expect(page.getByText(/alpha-/)).toBeVisible();
    await expect(page.getByText(/beta-/)).toHaveCount(0);
    await page.getByLabel("Search documents").fill("zzz-nothing");
    await expect(page.getByText(/No documents match/)).toBeVisible();
  });
});

test.describe("/patient/medical-records", () => {
  test("a completed visit shows; search filters; empty state for a new patient", async ({ loginAs, api, tag, cleanup }) => {
    const uniq = tag("mrcomplaint");
    const { me } = await patientWithVisit({ tag, cleanup }, api, "mr", { diagnosis: "E2E-dx-uniqueword", complaint: uniq });
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/medical-records");
    await expect(page.getByRole("button", { name: /E2E-dx-uniqueword/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search records" }).fill("no-such-thing-zz");
    await expect(page.getByRole("button", { name: /E2E-dx-uniqueword/ })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search records" }).fill(uniq);
    await expect(page.getByRole("button", { name: /E2E-dx-uniqueword/ })).toBeVisible();
    await page.getByRole("button", { name: /E2E-dx-uniqueword/ }).click();
    await expect(page.getByText(uniq).first()).toBeVisible();

    const fresh = await registerFreshPatient(tag("mrempty"));
    cleanup(() => fresh.dispose());
    const p2 = await loginAs(fresh.email, fresh.password);
    await p2.goto("/patient/medical-records");
    await expect(p2.getByRole("heading", { name: "Medical records" })).toBeVisible();
    await expect(p2.getByRole("button", { name: /E2E-dx/ })).toHaveCount(0);
  });
});

test.describe("/patient/prescriptions", () => {
  test("prescription card, search, and Print opens the print sheet with the medicine", async ({ loginAs, api, tag, cleanup }) => {
    const { me, visit } = await patientWithVisit({ tag, cleanup }, api, "rx", { rx: true });
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/prescriptions");
    await expect(page.getByText(new RegExp(visit.medicine!.split(" ")[0]))).toBeVisible();
    await page.getByRole("searchbox", { name: "Search prescriptions" }).fill("zzzz-none");
    await expect(page.getByText(new RegExp(visit.medicine!.split(" ")[0]))).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search prescriptions" }).fill(visit.medicine!.split(" ")[0]);
    const popupP = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Print" }).first().click();
    const popup = await popupP;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator("body")).toContainText(visit.medicine!.split(" ")[0]);
  });

  test("empty state for a patient with no prescriptions", async ({ loginAs, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("rxempty"));
    cleanup(() => me.dispose());
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/prescriptions");
    await expect(page.getByRole("heading", { name: "Prescriptions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toHaveCount(0);
  });
});

test.describe("/patient/vaccinations", () => {
  test("a dose given at the visit is listed with dose / date / status, and searchable", async ({ loginAs, api, tag, cleanup }) => {
    const { me } = await patientWithVisit({ tag, cleanup }, api, "vac", { vaccine: "E2E-Flu-Vaccine" });
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/vaccinations");
    const row = page.getByRole("row").filter({ hasText: "E2E-Flu-Vaccine" });
    await expect(row).toContainText("1");
    await expect(row).toContainText("Administered");
    await page.getByRole("searchbox", { name: "Search vaccinations" }).fill("zzz-none");
    await expect(row).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search vaccinations" }).fill("E2E-Flu");
    await expect(row).toBeVisible();
  });

  test("Source column shows a readable label, not the raw enum", async ({ loginAs, api, tag, cleanup }) => {
    test.fail(true, "BUG-09: /patient/vaccinations prints the raw enum 'AdministeredInClinic' in the Source column");
    const { me } = await patientWithVisit({ tag, cleanup }, api, "vacsrc", { vaccine: "E2E-Src" });
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/vaccinations");
    await expect(page.getByRole("row").filter({ hasText: "E2E-Src" })).not.toContainText("AdministeredInClinic");
  });
});

test.describe("/patient/dashboard", () => {
  test("counts match the API: active / to pay / completed / prescriptions; paying moves a visit to Completed", async ({ loginAs, api, tag, cleanup }) => {
    const { me, visit } = await patientWithVisit({ tag, cleanup }, api, "dash", { rx: true });
    const open = await completeVisitViaApi({ staff: await api("staff"), doctor: await api("doctor") }, me.patientId, { leaveOpen: true });
    cleanup(async () => void (await (await api("staff")).put(`/api/queue/${open.booking_id}/cancel`, { data: { reason: "E2E cleanup" } })));
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/dashboard");
    const stat = (label: string) => page.getByRole("link", { name: new RegExp(`\\d+ ${label}`) });
    await expect(stat("Visits to pay for")).toContainText("1");
    await expect(stat("Completed visits")).toContainText("0");
    await expect(stat("Prescriptions")).toContainText("1");
    const staff = await api("staff");
    const pay = await getPaymentForBooking(staff, visit.booking_id);
    expect((await staff.post(`/api/payments/${pay.payment_id}/confirm`, { data: { payment_method: "Cash", amount_received: 450 } })).ok()).toBeTruthy();
    await page.reload();
    await expect(stat("Visits to pay for")).toContainText("0");
    await expect(stat("Completed visits")).toContainText("1");
  });

  test("a brand-new patient sees the empty states and a working Book a visit button", async ({ loginAs, tag, cleanup }) => {
    const me = await registerFreshPatient(tag("dashnew"));
    cleanup(() => me.dispose());
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/dashboard");
    await expect(page.getByRole("heading", { name: "No upcoming appointment" })).toBeVisible();
    await page.getByRole("link", { name: "Book a visit" }).first().click();
    await expect(page).toHaveURL(/\/patient\/bookings/);
  });

  test("upcoming appointment card appears after online booking (Pending)", async ({ loginAs, tag, cleanup }) => {
    test.fail(true, "BUG-10: dashboard only treats Confirmed/CheckedIn as upcoming, so a freshly booked (Pending) queue number says 'No upcoming appointment'");
    const me = await registerFreshPatient(tag("dashup"));
    cleanup(() => me.dispose());
    const b = await me.api.post("/api/bookings/book", { data: { appointment_date: manilaDate(), visit_type: "New" } });
    const bk = await b.json();
    cleanup(async () => void (await me.api.put(`/api/bookings/${bk.booking_id}/cancel`, { data: { reason: "E2E" } })));
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/dashboard");
    await expect(page.getByText(bk.queue_number).first()).toBeVisible();
  });

  test("upcoming appointment card appears once the front desk checks the patient in", async ({ loginAs, api, tag, cleanup }) => {
    test.fail(true, "BUG-11: Next Appointment card prints a fake '12:00 AM' time for a queue visit and omits the queue number");
    const me = await registerFreshPatient(tag("dashci"));
    cleanup(() => me.dispose());
    const bk = await (await me.api.post("/api/bookings/book", { data: { appointment_date: manilaDate(), visit_type: "New" } })).json();
    const staff = await api("staff");
    expect((await staff.put(`/api/queue/${bk.booking_id}/check-in`)).ok()).toBeTruthy();
    cleanup(async () => void (await staff.put(`/api/queue/${bk.booking_id}/cancel`, { data: { reason: "E2E cleanup" } })));
    const page = await loginAs(me.email, me.password);
    await page.goto("/patient/dashboard");
    await expect(page.getByRole("region", { name: "Next Appointment" })).toBeVisible();
    await expect(page.getByRole("link", { name: /1 Active Appointments/ })).toBeVisible();
    // BUG-11 (soft): a queue visit has no clock time, yet the card prints "12:00 AM" and omits the queue number
    expect.soft(await page.getByRole("region", { name: "Next Appointment" }).innerText(), "Next Appointment card").not.toContain("12:00 AM");
    expect.soft(await page.getByRole("region", { name: "Next Appointment" }).innerText(), "Next Appointment card shows the queue number").toContain(bk.queue_number);
  });
});
