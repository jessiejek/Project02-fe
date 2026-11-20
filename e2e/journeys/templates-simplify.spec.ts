import { test, expect, type Page } from "../support/fixtures";

//JJQR - AI (Nov 20, 2026) A1 A2 A4 — /doctor/templates: one list, built-ins as her rows, restore built-ins
const TABS: { tab: string; button: RegExp }[] = [
  { tab: "soap", button: /SOAP \(\d+\)/ },
  { tab: "phrases", button: /Phrases \(\d+\)/ },
  { tab: "rx", button: /Prescriptions \(\d+\)/ },
  { tab: "favorites", button: /Favorites \(\d+\)/ },
  //JJQR Nov 20, 2026 - Diagnoses tab hidden
  { tab: "certificates", button: /Certificates \(\d+\)/ },
];

async function openTemplates(as: (role: "doctor") => Promise<Page>, tab = "soap") {
  const page = await as("doctor");
  await page.goto(`/doctor/templates?tab=${tab}`);
  await expect(page.getByRole("button", { name: /SOAP \(\d+\)/ })).toBeVisible({ timeout: 15_000 });
  return page;
}

async function expectNoSourceSpecialty(page: Page) {
  await expect(page.getByRole("group", { name: "Source" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Specialty" })).toHaveCount(0);
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Specialty", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Mine", { exact: true })).toHaveCount(0);
  await expect(page.getByText("System", { exact: true })).toHaveCount(0);
}

function firstRow(page: Page) {
  return page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Edit", exact: true }) }).first();
}

test.describe("Templates simplify A1 A2 A4", () => {
  test("A1 each tab has no Source/Specialty filters and rows show Edit/Duplicate/Delete", async ({ as }) => {
    const page = await openTemplates(as);
    for (const { tab, button } of TABS) {
      await page.getByRole("button", { name: button }).click();
      await expect(page.getByRole("button", { name: button })).toHaveAttribute("aria-current", "page");
      await expectNoSourceSpecialty(page);
      const restore = page.getByRole("button", { name: "Restore built-in templates" });
      if (tab === "favorites") {
        await expect(restore).toHaveCount(0);
      } else {
        await expect(restore).toBeVisible();
      }
      const row = firstRow(page);
      if (await row.count() === 0) continue;
      await expect(row.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
      if (tab === "favorites") {
        await expect(row.getByRole("button", { name: "Duplicate", exact: true })).toHaveCount(0);
      } else {
        await expect(row.getByRole("button", { name: "Duplicate", exact: true })).toBeVisible();
      }
    }
  });

  test("A2 built-in titles appear as her rows (no System badge) and reloading does not duplicate", async ({ as }) => {
    const page = await openTemplates(as, "soap");
    await expect(page.locator('ul[data-view="list"] > li').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("System", { exact: true })).toHaveCount(0);
    const titles = async () =>
      page.locator('ul[data-view="list"] > li').evaluateAll((lis) =>
        lis.map((li) => (li.querySelector("span")?.textContent ?? "").trim()).filter(Boolean),
      );
    const before = await titles();
    expect(before.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator('ul[data-view="list"] > li').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("System", { exact: true })).toHaveCount(0);
    const after = await titles();
    expect(after).toEqual(before);
  });

  test("A4 delete a template, Restore built-in templates brings it back; other edits stay", async ({ as, tag }) => {
    const page = await openTemplates(as, "soap");
    await expect(page.locator('ul[data-view="list"] > li').first()).toBeVisible({ timeout: 15_000 });

    const keepTitle = `E2E keep ${tag("tpl")}`;
    const keepPlan = `keep-plan ${tag("plan")}`;
    await page.getByRole("button", { name: "New SOAP template" }).click();
    const create = page.getByRole("dialog", { name: "New SOAP template" });
    await create.getByLabel("Template name").fill(keepTitle);
    await create.getByLabel("Plan").fill(keepPlan);
    await create.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`SOAP template “${keepTitle}” saved.`)).toBeVisible();

    const builtInRow = page.getByRole("listitem").filter({ hasNotText: keepTitle }).filter({ has: page.getByRole("button", { name: "Delete", exact: true }) }).first();
    const builtInTitle = ((await builtInRow.locator("span").first().textContent()) ?? "").trim();
    expect(builtInTitle).toBeTruthy();

    await builtInRow.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete this item?" }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`Deleted “${builtInTitle}”.`)).toBeVisible();
    await page.waitForTimeout(5_500);
    await expect(page.getByRole("listitem").filter({ hasText: builtInTitle })).toHaveCount(0);

    await page.getByRole("button", { name: "Restore built-in templates" }).click();
    const restoreDlg = page.getByRole("dialog", { name: "Restore built-in templates?" });
    await expect(restoreDlg).toBeVisible();
    await expect(restoreDlg.getByText("This adds back any built-in templates you deleted. Your own templates and edits are not changed.")).toBeVisible();
    await restoreDlg.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText(/Restored \d+ template\(s\)|Nothing to restore/)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: builtInTitle }).first()).toBeVisible();

    const keepRow = page.getByRole("listitem").filter({ hasText: keepTitle });
    await expect(keepRow).toBeVisible();
    await keepRow.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = page.getByRole("dialog", { name: `Edit “${keepTitle}”` });
    await expect(edit.getByLabel("Plan")).toHaveValue(keepPlan);

    await edit.getByRole("button", { name: "Close" }).click();
    await keepRow.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete this item?" }).getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(5_500);
  });
});
