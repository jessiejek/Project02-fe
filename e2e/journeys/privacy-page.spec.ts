import { test, expect } from "../support/fixtures";

/** /privacy is a public page (no sign-in), reachable from /login and /register. */
test.describe("/privacy", () => {
  test("opens without signing in, in English and Filipino", async ({ anon }) => {
    const page = await anon();
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Notice" })).toBeVisible();
    await expect(page.getByText(/Republic Act No. 10173/)).toBeVisible();
    await page.getByRole("link", { name: "Basahin sa Filipino" }).click();
    await expect(page).toHaveURL(/lang=fil/);
    await expect(page.getByRole("heading", { level: 1, name: "Paunawa sa Privacy" })).toBeVisible();
  });

  for (const from of ["/login", "/register"]) {
    test(`${from} links to /privacy`, async ({ anon }) => {
      const page = await anon();
      await page.goto(from);
      await expect(page.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    });
  }
});
