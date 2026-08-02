const { expect, test } = require("../fixtures/app");
const { connectExplorer, setEditorText } = require("./helpers");

test("saving an untitled tab names it inline and preserves its content", async ({
  app,
  drive,
  page,
}) => {
  const folder = drive.addFolder({ id: "work", name: "WORK" });
  await connectExplorer(page);
  await page.getByRole("treeitem", { name: /WORK/ }).click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await setEditorText(page, "important draft content");

  await page.locator("#explorerToggle").click();
  await page.locator("#saveButton").click();
  await expect(page.locator("#fileExplorer")).toBeVisible();

  const input = page.locator(".explorer-create-input");
  await expect(input).toHaveValue(".txt");
  await input.fill("draft.txt");
  await input.press("Enter");

  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toHaveText(
    "draft.txt"
  );
  await expect.poll(() => drive.findByName("draft.txt")?.content).toBe(
    "important draft content"
  );
  expect(drive.findByName("draft.txt").parents[0]).toBe(folder.id);
  await expect(page.locator('.tab[aria-selected="true"] .tab-close')).toHaveText("X");
});
