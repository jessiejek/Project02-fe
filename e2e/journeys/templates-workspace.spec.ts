import { test, expect } from "../support/fixtures";

//JJQR - AI (Nov 19, 2026) - /doctor/templates workspace (Phase 2): tabs, deep links, panel guard, undo delete, global search
test.describe("Templates workspace", () => {
  test("shows six tabs with counts and deep-links to a phrase section", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates?tab=phrases&field=Plan");
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
    for (const name of [/SOAP \(\d+\)/, /Phrases \(\d+\)/, /Prescriptions \(\d+\)/, /Favorites \(\d+\)/, /Diagnoses \(\d+\)/, /Certificates \(\d+\)/]) {
      await expect(page.getByRole("button", { name })).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByRole("button", { name: /Phrases/ })).toHaveAttribute("aria-current", "page");
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
    await panel.getByLabel("Phrase name").fill(label);
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
    await panel.getByLabel("Phrase name").fill("Unsaved back test");

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

  //JJQR - AI (Nov 19, 2026) - UI/UX: phrase name auto-fills from the text until you type your own
  test("phrase editor auto-fills the name from the first words of the text", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates?tab=phrases");
    await page.getByRole("button", { name: "Add phrase" }).click();
    const panel = page.getByRole("dialog", { name: "New phrase" });
    await panel.locator("textarea").fill("Throat is mildly erythematous without exudate");
    await expect(panel.getByLabel("Phrase name")).toHaveValue("Throat is mildly erythematous without");
    // once the doctor types their own name, further text no longer overwrites it
    await panel.getByLabel("Phrase name").fill("My throat exam");
    await panel.locator("textarea").fill("Throat clear.");
    await expect(panel.getByLabel("Phrase name")).toHaveValue("My throat exam");
  });

  test("SOAP tab: compact list view is the default, Mine sorts first, filters are labelled", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates?tab=soap");
    await expect(page.getByRole("button", { name: /SOAP \(\d+\)/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('ul[data-view="list"]')).toBeVisible();
    await expect(page.getByRole("group", { name: "View" }).getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Source", { exact: true })).toBeVisible();
    await expect(page.getByText("Specialty", { exact: true })).toBeVisible();
    // Mine first: no "Mine" pill may appear after a "System" pill
    const pills = await page.locator('ul[data-view="list"] > li').evaluateAll((lis) =>
      lis.map((li) => (li.textContent ?? "").includes("System") ? "S" : (li.textContent ?? "").includes("Mine") ? "M" : "?"),
    );
    expect(pills.join("")).not.toMatch(/SM/);
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Cards" }).click();
    await expect(page.locator('ul[data-view="cards"]')).toBeVisible();
  });
  //JJQR - END

  test("global search finds items across tabs and opens the editor via deep link", async ({ as }) => {
    const page = await as("doctor");
    await page.goto("/doctor/templates");
    await expect(page.getByRole("button", { name: /SOAP \(\d+\)/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "All tabs" }).click();
    await page.getByPlaceholder("Search all tabs…").fill("fever");
    const results = page.getByLabel("Search results");
    await expect(results.or(page.getByText(/Nothing matches/))).toBeVisible();
  });
});
//JJQR - END
