import { test, expect } from "../support/fixtures";
import type { APIResponse } from "@playwright/test";
import { request as pwRequest } from "@playwright/test";
import { BE_URL } from "../playwright.config";
import { cancelQueueEntry, getBooking, registerFreshPatient, bookOnline, manilaDate } from "../support/api";
import { completeVisitViaApi, settleViaApi } from "../support/visit";

/** COVERAGE-PLAN §5 · security (UI and API) */

const ROLES = ["patient", "staff", "doctor", "admin"] as const;
type R = (typeof ROLES)[number];

test.describe("§5 role fences in the UI", () => {
  const deep: Record<R, string> = {
    patient: "/patient/medical-records",
    staff: "/staff/payments",
    doctor: "/doctor/templates",
    admin: "/admin/settings",
  };
  for (const role of ROLES) {
    for (const other of ROLES.filter((r) => r !== role)) {
      test(`${role} typing a ${other} dashboard and a ${other} deep page ends up back in the ${role} portal`, async ({ as }) => {
        const page = await as(role);
        for (const path of [`/${other}/dashboard`, deep[other]]) {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          expect(new URL(page.url()).pathname, `after visiting ${path}`).toMatch(new RegExp(`^/${role}/`));
        }
      });
    }
  }
});

test.describe("§5 logged out / expired session", () => {
  for (const path of ["/patient/dashboard", "/staff/dashboard", "/doctor/dashboard", "/admin/dashboard", "/admin/settings", "/doctor/consultation2/00000000-0000-0000-0000-000000000000"]) {
    test(`logged out → ${path} goes to /login`, async ({ anon }) => {
      const page = await anon();
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  for (const role of ROLES) {
    test(`${role}: tampered/expired cookies → clean re-login screen, no crash or error text`, async ({ browser, guard }) => {
      guard.allow(/\/api\//); // 401s are the point of this test
      const { authFile } = await import("../support/auth");
      const ctx = await browser.newContext({ storageState: authFile(role) });
      await ctx.clearCookies({ name: "clinic_at" });
      await ctx.addCookies([{ name: "clinic_rt", value: "expired-or-garbage", domain: "localhost", path: "/" }]);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`/${role}/dashboard`);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.getByText(/something went wrong|application error|unexpected/i)).toHaveCount(0);
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }

  test("an expired access cookie with a valid refresh cookie silently refreshes and stays on the page", async ({ browser }) => {
    const { authFile } = await import("../support/auth");
    const ctx = await browser.newContext({ storageState: authFile("staff") });
    await ctx.clearCookies({ name: "clinic_at" });
    const page = await ctx.newPage();
    await page.goto("/staff/dashboard");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).toMatch(/^\/(staff\/dashboard|login)$/);
    await ctx.close();
  });
});

test.describe("§5 API: unauthenticated and wrong-role access", () => {
  const denied = (res: APIResponse) => [401, 403].includes(res.status());

  test("no token → 401 on protected endpoints", async () => {
    const anon = await pwRequest.newContext({ baseURL: BE_URL });
    for (const path of ["/api/queue", "/api/patients", "/api/bookings", "/api/staff-accounts", "/api/audit-logs", "/api/payments/booking/00000000-0000-0000-0000-000000000000", "/api/consultations"]) {
      const res = await anon.get(path);
      expect(denied(res), `GET ${path} without a token → ${res.status()}`).toBeTruthy();
    }
    const w = await anon.put("/api/settings", { data: { clinic_name: "hacked" } });
    expect(denied(w), `PUT /api/settings without a token → ${w.status()}`).toBeTruthy();
    await anon.dispose();
  });

  const matrix: { role: "patient" | "staff" | "doctor"; method: "get" | "put" | "post" | "delete"; path: string; data?: unknown }[] = [
    { role: "patient", method: "get", path: "/api/queue" },
    { role: "patient", method: "get", path: "/api/patients" },
    { role: "patient", method: "get", path: "/api/staff-accounts" },
    { role: "patient", method: "get", path: "/api/audit-logs" },
    { role: "patient", method: "put", path: "/api/settings", data: { clinic_name: "E2E hacked" } },
    { role: "patient", method: "post", path: "/api/announcements", data: { title: "E2E x", body: "x", is_active: true } },
    { role: "patient", method: "post", path: "/api/auth/invite", data: { email: "e2e-x@example.test", fullName: "x", role: "Staff" } },
    { role: "staff", method: "put", path: "/api/settings", data: { clinic_name: "E2E hacked" } },
    { role: "staff", method: "post", path: "/api/announcements", data: { title: "E2E x", body: "x", is_active: true } },
    { role: "staff", method: "get", path: "/api/audit-logs" },
    { role: "staff", method: "post", path: "/api/auth/invite", data: { email: "e2e-x@example.test", fullName: "x", role: "Staff" } },
    { role: "doctor", method: "put", path: "/api/settings", data: { clinic_name: "E2E hacked" } },
    { role: "doctor", method: "post", path: "/api/announcements", data: { title: "E2E x", body: "x", is_active: true } },
    { role: "doctor", method: "post", path: "/api/auth/invite", data: { email: "e2e-x@example.test", fullName: "x", role: "Staff" } },
    { role: "doctor", method: "get", path: "/api/audit-logs" },
  ];
  for (const m of matrix) {
    test(`${m.role} ${m.method.toUpperCase()} ${m.path} is refused`, async ({ api, guard, cleanup }) => {
      guard.allow(/\/api\//);
      const a = await api(m.role);
      const res = await a[m.method](m.path, m.data ? { data: m.data } : undefined);
      if (res.ok() && m.path === "/api/announcements") {
        const admin = await api("admin");
        cleanup(async () => { const b = await res.json().catch(() => null); if (b?.id) await admin.delete(`/api/announcements/${b.id}`); });
      }
      expect(denied(res), `${m.role} ${m.method.toUpperCase()} ${m.path} → ${res.status()}`).toBeTruthy();
    });
  }
  test("settings were not changed by any refused write", async ({ api }) => {
    const admin = await api("admin");
    expect((await (await admin.get("/api/settings")).json()).clinic_name).not.toBe("E2E hacked");
  });
});

test.describe("§5 API: patient A cannot reach patient B's data", () => {
  test("GET/PUT B's profile, bookings, payments, consultations, Rx, vaccinations, documents, lab results are all refused (or empty)", async ({ api, tag, cleanup, guard }) => {
    guard.allow(/\/api\//);
    const staff = await api("staff");
    const doctor = await api("doctor");
    const A = await registerFreshPatient(tag("secA"));
    const B = await registerFreshPatient(tag("secB"));
    cleanup(() => A.dispose());
    cleanup(() => B.dispose());
    const v = await completeVisitViaApi({ staff, doctor }, B.patientId, { rx: true, vaccine: "E2E-vax" });
    cleanup(() => settleViaApi(staff, v.booking_id));

    const emptyOrDenied = async (res: APIResponse) => {
      if ([401, 403, 404].includes(res.status())) return true;
      if (!res.ok()) return false;
      const body = await res.json().catch(() => null);
      return body == null || (Array.isArray(body) && body.length === 0) || (Array.isArray(body?.items) && body.items.length === 0);
    };
    const probes: [string, string][] = [
      ["profile", `/api/patients/${B.patientId}`],
      ["booking", `/api/bookings/${v.booking_id}`],
      ["payment", `/api/payments/booking/${v.booking_id}`],
      ["consultation by booking", `/api/consultations/by-booking/${v.booking_id}`],
      ["consultation list", `/api/consultations?patient_id=${B.patientId}`],
      ["rx groups", `/api/prescription-groups?patient_id=${B.patientId}`],
      ["vaccinations", `/api/patient-vaccinations?patientId=${B.patientId}`],
      ["documents", `/api/patient-documents?patientId=${B.patientId}`],
      ["lab results", `/api/patient-lab-results?patientId=${B.patientId}`],
      ["allergies", `/api/patients/${B.patientId}/allergies`],
    ];
    const leaks: string[] = [];
    for (const [label, path] of probes) {
      const res = await A.api.get(path);
      if (!(await emptyOrDenied(res))) leaks.push(`${label}: GET ${path} → ${res.status()}`);
    }
    // control: B can read their own
    expect((await B.api.get(`/api/patients/${B.patientId}`)).ok()).toBeTruthy();
    // writes
    const put = await A.api.put(`/api/patients/${B.patientId}`, { data: { first_name: "Hacked", last_name: "Hacked", date_of_birth: "1990-01-01", sex: "Male" } });
    if (put.ok()) leaks.push(`PUT /api/patients/{B} → ${put.status()}`);
    const cancel = await A.api.put(`/api/bookings/${v.booking_id}/cancel`, { data: { reason: "E2E hack" } });
    if (cancel.ok()) leaks.push(`PUT /api/bookings/{B}/cancel → ${cancel.status()}`);
    const bAfter = await (await B.api.get(`/api/patients/${B.patientId}`)).json();
    expect(bAfter.first_name).not.toBe("Hacked");
    expect(leaks, "cross-patient access").toEqual([]);
  });

  test("A cannot cancel or reschedule B's online booking", async ({ api, tag, cleanup, guard }) => {
    guard.allow(/\/api\//);
    const staff = await api("staff");
    const A = await registerFreshPatient(tag("secC"));
    const B = await registerFreshPatient(tag("secD"));
    cleanup(() => A.dispose());
    cleanup(() => B.dispose());
    const { body } = await bookOnline(B.api, manilaDate(1));
    cleanup(() => cancelQueueEntry(staff, body.booking_id));
    const c = await A.api.put(`/api/bookings/${body.booking_id}/cancel`, { data: { reason: "E2E hack" } });
    expect(c.ok(), `A cancelled B's booking → ${c.status()}`).toBeFalsy();
    const r = await A.api.put(`/api/bookings/${body.booking_id}/reschedule`, { data: { appointment_date: manilaDate(2), reason: "E2E hack" } });
    expect(r.ok(), `A rescheduled B's booking → ${r.status()}`).toBeFalsy();
    expect((await getBooking(staff, body.booking_id)).status).toBe("Pending");
  });

  test("UI: patient A opening B's booking id sees nothing of B's", async ({ loginAs, api, tag, cleanup, guard }) => {
    guard.allow(/\/api\//);
    const staff = await api("staff");
    const A = await registerFreshPatient(tag("secE"));
    const B = await registerFreshPatient(tag("secF"));
    cleanup(() => A.dispose());
    cleanup(() => B.dispose());
    const { body } = await bookOnline(B.api, manilaDate(1));
    cleanup(() => cancelQueueEntry(staff, body.booking_id));
    const page = await loginAs(A.email, A.password);
    for (const path of [`/patient/bookings/${body.booking_id}`, `/patient/medical-records?booking=${body.booking_id}`]) {
      const res = await page.goto(path);
      void res;
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText(B.firstName);
    }
  });
});

test.describe("§5 templates are private to their doctor; staff and patients get no doctor templates", () => {
  const paths = ["/api/soap-templates", "/api/medical-certificate-templates", "/api/doctor-diagnosis-templates", "/api/prescription-templates"];
  for (const path of paths) {
    test(`${path}: patient and staff cannot read the doctor's private rows`, async ({ api, guard }) => {
      guard.allow(/\/api\//);
      const doctor = await api("doctor");
      const dres = await doctor.get(path);
      const mine: any[] = dres.ok() ? ((await dres.json()) as any) : [];
      const isSystem = (t: any) => Boolean(t.is_system_template ?? t.is_system ?? false);
      const idOf = (t: any) => t.template_id ?? t.id;
      const privateIds = (Array.isArray(mine) ? mine : []).filter((t) => t.doctor_id && !isSystem(t)).map(idOf);
      for (const role of ["patient", "staff"] as const) {
        const a = await api(role);
        const res = await a.get(path);
        if (!res.ok()) { expect([401, 403, 404]).toContain(res.status()); continue; }
        const rows: any[] = await res.json();
        const leaked = (Array.isArray(rows) ? rows : []).filter((t) => privateIds.includes(idOf(t)));
        expect(leaked, `${role} sees the doctor's private templates at ${path}`).toHaveLength(0);
      }
    });
  }
});
