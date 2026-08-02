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

test("consecutive saves ignore Drive version drift when content is unchanged", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "notes", name: "notes.txt", content: "original" });
  drive.setPostUploadVersionDrift("notes");
  await connectExplorer(page);
  await page.getByRole("treeitem", { name: /notes\.txt/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");

  await setEditorText(page, "first edit");
  await page.locator("#saveButton").click();
  await expect(page.locator("#status")).toHaveText("SAVED");

  await setEditorText(page, "second edit");
  await page.locator("#saveButton").click();
  await expect(page.locator("#status")).toHaveText("SAVED");
  expect(drive.get("notes").content).toBe("second edit");
});

test("saving still blocks when Drive content actually changed", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "shared", name: "shared.txt", content: "original" });
  await connectExplorer(page);
  await page.getByRole("treeitem", { name: /shared\.txt/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");

  await setEditorText(page, "local edit");
  drive.updateFileContent("shared", "remote edit");
  await page.locator("#saveButton").click();

  await expect(page.locator("#status")).toHaveText(
    "SAVE BLOCKED: FILE CHANGED IN DRIVE"
  );
  expect(drive.get("shared").content).toBe("remote edit");
});
