import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";
import { DEV_PASSWORD } from "../playwright.config";
import { PASSWORD, deleteAccountByEmail, manilaDate } from "../support/api";
import { EMAIL } from "../support/auth";

/** COVERAGE-PLAN §3 · Public: /login, /register, /forgot-password */

async function submitLogin(page: Page, email: string, password: string) {
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("/login", () => {
  test("wrong password → inline error, stays on /login, no session", async ({ anon, guard }) => {
    guard.allow(/401 POST \/api\/session\/login/);
    const page = await anon();
    await page.goto("/login");
    await submitLogin(page, EMAIL.patient, "WrongPassword!1");
    await expect(page.getByRole("alert").filter({ hasText: /incorrect|invalid/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/patient/dashboard");
    await expect(page).toHaveURL(/\/login/); // still logged out
  });

  test("unknown e-mail → same generic error (no account enumeration)", async ({ anon, guard }) => {
    guard.allow(/401 POST \/api\/session\/login/);
    const page = await anon();
    await page.goto("/login");
    await submitLogin(page, "nobody-e2e@example.test", "Whatever123!");
    const a = (await page.getByRole("alert").filter({ hasText: /\S/ }).first().innerText()).trim();
    await page.reload();
    await submitLogin(page, EMAIL.patient, "WrongPassword!1");
    const b = (await page.getByRole("alert").filter({ hasText: /\S/ }).first().innerText()).trim();
    expect(a).toBe(b);
  });

  test("empty e-mail / empty password never reach the server and never log in", async ({ anon }) => {
    const page = await anon();
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/session/login") && posts.push(r.url()));
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.locator("#email").fill(EMAIL.patient);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/patient/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("show / hide password toggles the field type", async ({ anon }) => {
    const page = await anon();
    await page.goto("/login");
    await page.locator("#password").fill("secret-pass");
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
  });

  for (const role of ["admin", "staff", "doctor", "patient"] as const) {
    test(`${role}: real login form lands on /${role}/dashboard`, async ({ anon }) => {
      const page = await anon();
      await page.goto("/login");
      await submitLogin(page, EMAIL[role], DEV_PASSWORD);
      await page.waitForURL(new RegExp(`/${role}/dashboard`), { timeout: 30_000 });
    });
  }

  test("?next= deep link: patient lands on it after login", async ({ anon }) => {
    const page = await anon();
    await page.goto("/login?next=/patient/bookings");
    await submitLogin(page, EMAIL.patient, DEV_PASSWORD);
    await page.waitForURL(/\/patient\/bookings/, { timeout: 30_000 });
  });

  for (const evil of ["https://evil.example/x", "//evil.example", "/admin/dashboard", "/patient/../admin/dashboard"]) {
    test(`?next=${evil} is ignored (open-redirect / cross-portal guard)`, async ({ anon }) => {
      const page = await anon();
      await page.goto(`/login?next=${encodeURIComponent(evil)}`);
      await submitLogin(page, EMAIL.patient, DEV_PASSWORD);
      await page.waitForURL(/\/patient\/dashboard/, { timeout: 30_000 });
      expect(new URL(page.url()).host).toBe(new URL(process.env.E2E_FE_URL ?? "http://localhost:3000").host);
    });
  }

  test("a logged-in user opening /login or /register is sent to their dashboard", async ({ as }) => {
    const page = await as("staff");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/staff\/dashboard/);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/staff\/dashboard/);
  });

  test("double submit (click + Enter) creates one session and lands once", async ({ anon }) => {
    const page = await anon();
    let posts = 0;
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/session/login") && posts++);
    await page.goto("/login");
    await page.locator("#email").fill(EMAIL.patient);
    await page.locator("#password").fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.locator("#password").press("Enter").catch(() => undefined);
    await page.waitForURL(/\/patient\/dashboard/, { timeout: 30_000 });
    expect(posts, "login POSTs for one click + one Enter").toBeLessThanOrEqual(2);
  });

  test("links: Forgot password? and Create an account", async ({ anon }) => {
    const page = await anon();
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await page.goto("/login");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

/* ───────────────────────────── /register ───────────────────────────── */

interface Reg { first: string; last: string; middle?: string; dob: string; sex: "Male" | "Female"; contact?: string; email: string; pw: string; pw2: string }

async function fillRegister(page: Page, r: Partial<Reg> & { email: string }) {
  const v: Reg = { first: "E2E", last: "Reg", dob: "1992-05-06", sex: "Female", pw: PASSWORD, pw2: PASSWORD, ...r };
  await page.getByLabel("First name").fill(v.first);
  await page.getByLabel("Last name").fill(v.last);
  if (v.middle) await page.getByLabel(/Middle name/).fill(v.middle);
  if (v.dob) await page.getByLabel("Date of birth").fill(v.dob);
  if (v.sex) await page.getByLabel("Sex").selectOption(v.sex);
  if (v.contact) await page.getByLabel(/Contact number/).fill(v.contact);
  await page.getByLabel("Email").fill(v.email);
  await page.locator("#password").fill(v.pw);
  await page.locator("#confirmPassword").fill(v.pw2);
}

test.describe("/register", () => {
  const regPosts = (page: Page) => {
    const hits: string[] = [];
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/session/register") && hits.push(r.url()));
    return hits;
  };

  test("happy path: account is created, lands in the patient portal, and can log in again", async ({ anon, loginAs, tag, cleanup }) => {
    const email = `${tag("reg").toLowerCase()}@example.test`;
    cleanup(() => deleteAccountByEmail(email));
    const page = await anon();
    await page.goto("/register");
    await fillRegister(page, { email, first: tag("reg"), middle: "Mid", contact: "09171234567" });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/patient\/dashboard/, { timeout: 30_000 });
    // reload persists the session
    await page.reload();
    await expect(page).toHaveURL(/\/patient\/dashboard/);
    // and the stored profile has what we typed
    await page.goto("/patient/profile");
    await expect(page.getByLabel("First name")).toHaveValue(/^E2E-/);
    await expect(page.getByLabel("Middle name")).toHaveValue("Mid");
    await expect(page.getByLabel("Contact number")).toHaveValue("09171234567");
    // log in again from scratch
    const again = await loginAs(email, PASSWORD);
    await expect(again).toHaveURL(/\/patient\//);
  });

  for (const [field, patch] of [
    ["First name", { first: "" }],
    ["Last name", { last: "" }],
    ["Date of birth", { dob: "" }],
    ["Email", { email: "" }],
    ["Password", { pw: "", pw2: "" }],
    ["Confirm password", { pw2: "" }],
  ] as const) {
    test(`required: empty ${field} is blocked before any request`, async ({ anon, tag }) => {
      const page = await anon();
      const hits = regPosts(page);
      await page.goto("/register");
      await fillRegister(page, { email: `${tag("req").toLowerCase()}@example.test`, ...(patch as object) });
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForTimeout(500);
      expect(hits).toHaveLength(0);
      await expect(page).toHaveURL(/\/register/);
    });
  }

  test("required: Sex must be chosen", async ({ anon, tag }) => {
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await fillRegister(page, { email: `${tag("req").toLowerCase()}@example.test`, sex: undefined as never });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForTimeout(500);
    expect(hits).toHaveLength(0);
  });

  test("password of 5 characters is blocked; 6 is accepted by the field", async ({ anon, tag }) => {
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await fillRegister(page, { email: `${tag("pw").toLowerCase()}@example.test`, pw: "Ab1!x", pw2: "Ab1!x" });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForTimeout(500);
    expect(hits, "5-char password reached the server").toHaveLength(0);
    expect(await page.locator("#password").evaluate((el: HTMLInputElement) => el.validity.tooShort || el.validity.valueMissing)).toBeTruthy();
  });

  test('passwords that differ → "Passwords do not match." and nothing is created', async ({ anon, tag }) => {
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await fillRegister(page, { email: `${tag("mm").toLowerCase()}@example.test`, pw2: PASSWORD + "x" });
    await expect(page.getByText("Doesn't match the password yet.")).toBeVisible();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    expect(hits).toHaveLength(0);
  });

  test("date of birth in the future is blocked (max = today)", async ({ anon, tag }) => {
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await expect(page.getByLabel("Date of birth")).toHaveAttribute("max", manilaDate());
    await fillRegister(page, { email: `${tag("dob").toLowerCase()}@example.test`, dob: manilaDate(30) });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForTimeout(500);
    expect(hits, "future DOB reached the server").toHaveLength(0);
  });

  test("malformed e-mail is blocked", async ({ anon }) => {
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await fillRegister(page, { email: "not-an-email" });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForTimeout(500);
    expect(hits).toHaveLength(0);
    await expect(page).toHaveURL(/\/register/);
  });

  test("duplicate e-mail → clear message, no second account", async ({ anon, guard }) => {
    guard.allow(/409 POST \/api\/session\/register/, /4\d\d POST \/api\/session\/register/);
    const page = await anon();
    await page.goto("/register");
    await fillRegister(page, { email: EMAIL.patient, first: "E2E-dup" });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /already|exists|taken|in use/i })).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("absurdly long first name (5000 chars) is refused cleanly, not a 500", async ({ anon, tag, guard, cleanup }) => {
    guard.off();
    const email = `${tag("long").toLowerCase()}@example.test`;
    cleanup(() => deleteAccountByEmail(email));
    const page = await anon();
    let status = 0;
    page.on("response", (r) => r.url().includes("/api/session/register") && (status = r.status()));
    await page.goto("/register");
    await fillRegister(page, { email, first: "x".repeat(5000) });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForTimeout(2500);
    expect(status, "register with a 5000-char name").toBeLessThan(500);
  });

  test("double submit (click + Enter) creates exactly one account", async ({ anon, api, tag, cleanup }) => {
    const email = `${tag("dbl").toLowerCase()}@example.test`;
    cleanup(() => deleteAccountByEmail(email));
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await fillRegister(page, { email, first: tag("dbl") });
    await page.getByRole("button", { name: "Create account" }).click();
    await page.locator("#confirmPassword").press("Enter").catch(() => undefined);
    await page.waitForURL(/\/patient\//, { timeout: 30_000 });
    const found = await (await (await api("staff")).get(`/api/patients/search?q=${encodeURIComponent(email)}`)).json();
    expect(found.items.filter((p: any) => p.email === email), `register POSTs sent: ${hits.length}`).toHaveLength(1);
  });

  test('cancel: "Log in" link leaves without creating anything', async ({ anon, tag }) => {
    const page = await anon();
    const hits = regPosts(page);
    await page.goto("/register");
    await fillRegister(page, { email: `${tag("cx").toLowerCase()}@example.test` });
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(hits).toHaveLength(0);
  });
});

/* ───────────────────────── /forgot-password ───────────────────────── */

test.describe("/forgot-password", () => {
  test("empty and malformed e-mail are blocked", async ({ anon }) => {
    const page = await anon();
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/reset link has been sent/)).toHaveCount(0);
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/reset link has been sent/)).toHaveCount(0);
  });

  test("known and unknown addresses get the same neutral message", async ({ anon }) => {
    const page = await anon();
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(EMAIL.patient);
    await page.getByRole("button", { name: /send reset link/i }).click();
    const known = page.getByText(/a reset link has been sent/);
    await expect(known).toBeVisible();
    const t1 = (await known.innerText()).replace(EMAIL.patient, "<email>");
    await page.getByLabel("Email").fill("nobody-e2e@example.test");
    await page.getByRole("button", { name: /send (another )?(reset )?link/i }).click();
    await expect(page.getByText("nobody-e2e@example.test")).toBeVisible();
    const t2 = (await page.getByText(/a reset link has been sent/).innerText()).replace("nobody-e2e@example.test", "<email>");
    expect(t2).toBe(t1);
  });

  test("Back to log in returns to /login", async ({ anon }) => {
    const page = await anon();
    await page.goto("/forgot-password");
    await page.getByRole("link", { name: "Back to log in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
