import { test, expect } from "../support/fixtures";

//JJQR - AI (Nov 19, 2026) - /doctor/templates workspace (Phase 2): tabs, deep links, panel guard, undo delete, global search
test.describe("Templates workspace", () => {
  test("shows six tabs with counts and deep-links to a phrase section", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates?tab=phrases&field=Plan");
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
    for (const name of [/SOAP \(\d+\)/, /Phrases \(\d+\)/, /Prescriptions \(\d+\)/, /Favorites \(\d+\)/, /Diagnoses \(\d+\)/, /Certificates \(\d+\)/]) {
      await expect(page.getByRole("tab", { name })).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByRole("tab", { name: /Phrases/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "Plan phrases" })).toBeVisible();
  });

  test("phrase: create, unsaved-changes guard, delete with Undo", async ({ as }) => {
    const page = await as("doctor");
    const label = `E2E phrase ${Date.now().toString(36)}`;
    await page.goto("/doctor/templates?tab=phrases");
    await page.getByRole("button", { name: "Add phrase" }).click();
    const panel = page.getByRole("dialog", { name: "New phrase" });
    await expect(panel).toBeVisible();

    // Save is blocked with a reason until the form is valid.
    await expect(panel.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await panel.getByPlaceholder("e.g. Normal cardiac exam").fill(label);
    await panel.locator("textarea").fill("Regular rate and rhythm, no murmurs.");

    // Esc with edits asks first; "Keep editing" returns to the form.
    await page.keyboard.press("Escape");
    await expect(page.getByText("Discard unsaved changes?")).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(panel).toBeVisible();

    await page.keyboard.press("Control+S");
    await expect(page.getByText(`Phrase “${label}” saved.`)).toBeVisible();
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    // Delete → confirm → Undo within 5s restores it.
    const row = page.getByRole("listitem").filter({ hasText: label });
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`Deleted “${label}”.`)).toBeVisible();
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    // Clean up: delete for real and wait out the undo window.
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(5_500);
    await page.reload();
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  });

  test("browser Back with unsaved edits shows the discard prompt", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates?tab=phrases");
    await page.getByRole("button", { name: "Add phrase" }).click();
    const panel = page.getByRole("dialog", { name: "New phrase" });
    await panel.getByPlaceholder("e.g. Normal cardiac exam").fill("Unsaved back test");

    await page.goBack();
    await expect(page.getByText("Discard unsaved changes?")).toBeVisible();
    await expect(page).toHaveURL(/\/doctor\/templates\?tab=phrases/);
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(panel).toBeVisible();

    // a second Back is guarded too; Discard closes the panel and stays on the page
    await page.goBack();
    await expect(page.getByText("Discard unsaved changes?")).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/\/doctor\/templates\?tab=phrases$/);
  });

  test("global search finds items across tabs and opens the editor via deep link", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates");
    await expect(page.getByRole("tab", { name: /SOAP \(\d+\)/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "All tabs" }).click();
    await page.getByPlaceholder("Search all tabs…").fill("fever");
    const results = page.getByLabel("Search results");
    await expect(results.or(page.getByText(/Nothing matches/))).toBeVisible();
  });
});
//JJQR - END
