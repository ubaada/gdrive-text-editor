const { expect, test } = require("../fixtures/app");
const { connectExplorer, setEditorText } = require("./helpers");

async function openVersionedFile(page, drive, id, name) {
  drive.addFile({ id, name, content: "first revision" });
  drive.updateFileContent(id, "latest revision");
  await connectExplorer(page);
  await page.getByRole("treeitem", { name: new RegExp(name) }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await page.locator("#historyModeButton").click();
  await expect(page.locator(".revision-item")).toHaveCount(2);
}

test("preview preserves an unsaved working revision and blocks saving", async ({
  app,
  drive,
  page,
}) => {
  await openVersionedFile(page, drive, "notes", "notes.txt");
  await page.locator("#filesModeButton").click();
  await setEditorText(page, "unsaved working copy");
  await page.locator("#historyModeButton").click();

  await expect(page.locator(".revision-item.unsaved")).toContainText(
    "UNSAVED REVISION"
  );
  await page.getByRole("button", { name: "PREVIEW" }).click();

  await expect(page.locator("#revisionPreviewBar")).toBeVisible();
  await expect(page.locator('.tab[aria-selected="true"]')).toHaveClass(
    /revision-preview/
  );
  await expect(page.locator("#saveButton")).toBeDisabled();
  await expect(page.locator("#editor .view-lines")).toContainText("first revision");
  await page.keyboard.press("Control+S");
  expect(drive.get("notes").content).toBe("latest revision");

  await page.locator("#backToLatestButton").click();
  await expect(page.locator("#revisionPreviewBar")).toBeHidden();
  await expect(page.locator("#editor .view-lines")).toContainText(
    "unsaved working copy"
  );
  expect(drive.get("notes").content).toBe("latest revision");
});

test("restricted revisions are kept only after preview confirmation", async ({
  app,
  drive,
  page,
}) => {
  drive.restrictRevisionDownloads("restricted");
  await openVersionedFile(page, drive, "restricted", "restricted.txt");
  await page.getByRole("button", { name: "PREVIEW" }).click();

  await expect(page.locator("#confirmationTitle")).toHaveText(
    "KEEP REVISION FOREVER?"
  );
  await expect(page.locator("#confirmationMessage")).toContainText(
    "200-REVISION LIMIT"
  );
  await page.locator("#acceptConfirmationButton").click();

  await expect(page.locator("#revisionPreviewBar")).toBeVisible();
  expect(drive.getRevisions("restricted")[0].keepForever).toBe(true);
  await page.locator("#backToLatestButton").click();
  await expect(page.locator("#editor .view-lines")).toContainText(
    "latest revision"
  );
});

test("restore confirms, replaces Drive content, and discards unsaved edits", async ({
  app,
  drive,
  page,
}) => {
  await openVersionedFile(page, drive, "restore", "restore.txt");
  await page.locator("#filesModeButton").click();
  await setEditorText(page, "unsaved replacement");
  await page.locator("#historyModeButton").click();
  await page.getByRole("button", { name: "PREVIEW" }).click();
  await page.locator("#restoreRevisionButton").click();

  await expect(page.locator("#confirmationTitle")).toHaveText(
    "RESTORE REVISION?"
  );
  await expect(page.locator("#confirmationMessage")).toContainText(
    "UNSAVED REVISION WILL BE DISCARDED"
  );
  await page.locator("#cancelConfirmationButton").click();
  await expect(page.locator("#revisionPreviewBar")).toBeVisible();
  expect(drive.get("restore").content).toBe("latest revision");

  await page.locator("#restoreRevisionButton").click();
  await page.locator("#acceptConfirmationButton").click();

  await expect(page.locator("#status")).toHaveText("REVISION RESTORED");
  await expect(page.locator("#revisionPreviewBar")).toBeHidden();
  await expect(page.locator("#editor .view-lines")).toContainText("first revision");
  await expect(page.locator(".revision-item.unsaved")).toHaveCount(0);
  expect(drive.get("restore").content).toBe("first revision");
  expect(drive.getRevisions("restore")).toHaveLength(3);
});

test("restore conflict preserves the unsaved working revision", async ({
  app,
  drive,
  page,
}) => {
  await openVersionedFile(page, drive, "conflict", "conflict.txt");
  await page.locator("#filesModeButton").click();
  await setEditorText(page, "unsaved conflict copy");
  await page.locator("#historyModeButton").click();
  await page.getByRole("button", { name: "PREVIEW" }).click();
  drive.updateFileContent("conflict", "new remote content");
  await page.locator("#restoreRevisionButton").click();
  await page.locator("#acceptConfirmationButton").click();

  await expect(page.locator("#status")).toHaveText(
    "RESTORE BLOCKED: FILE CHANGED IN DRIVE"
  );
  await expect(page.locator("#revisionPreviewBar")).toBeVisible();
  await page.locator("#backToLatestButton").click();
  await expect(page.locator("#editor .view-lines")).toContainText(
    "unsaved conflict copy"
  );
  expect(drive.get("conflict").content).toBe("new remote content");
});

test("failed restore upload preserves the unsaved working revision", async ({
  app,
  drive,
  page,
}) => {
  await openVersionedFile(page, drive, "failure", "failure.txt");
  await page.locator("#filesModeButton").click();
  await setEditorText(page, "unsaved failure copy");
  await page.locator("#historyModeButton").click();
  await page.getByRole("button", { name: "PREVIEW" }).click();
  drive.failNextUpload("failure");
  await page.locator("#restoreRevisionButton").click();
  await page.locator("#acceptConfirmationButton").click();

  await expect(page.locator("#status")).toContainText("Upload failed");
  await expect(page.locator("#revisionPreviewBar")).toBeVisible();
  await page.locator("#backToLatestButton").click();
  await expect(page.locator("#editor .view-lines")).toContainText(
    "unsaved failure copy"
  );
  expect(drive.get("failure").content).toBe("latest revision");
});
