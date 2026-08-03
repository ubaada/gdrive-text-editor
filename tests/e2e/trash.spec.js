const { expect, test } = require("../fixtures/app");
const { connectExplorer, setEditorText } = require("./helpers");

function deleteButton(page, itemId) {
  return page.locator(
    `.explorer-item:has([data-item-id="${itemId}"]) .explorer-delete`
  );
}

test("file trash requires confirmation and closes a clean open tab", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "delete-file", name: "delete.txt", content: "saved" });
  await connectExplorer(page);
  await page.locator('[data-item-id="delete-file"]').click();
  await expect(page.locator("#status")).toHaveText("LOADED");

  await page.locator('[data-item-id="delete-file"]').hover();
  await deleteButton(page, "delete-file").click();
  await expect(page.locator("#confirmationTitle")).toHaveText("MOVE TO TRASH");
  await page.locator("#cancelConfirmationButton").click();
  expect(drive.get("delete-file").trashed).not.toBe(true);

  await page.locator('[data-item-id="delete-file"]').hover();
  await deleteButton(page, "delete-file").click();
  await page.locator("#acceptConfirmationButton").click();
  await expect(page.locator('[data-item-id="delete-file"]')).toHaveCount(0);
  await expect(page.locator("#status")).toHaveText("FILE MOVED TO TRASH");
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toContainText(
    "Untitled"
  );
  expect(drive.get("delete-file").trashed).toBe(true);
});

test("only empty folders can be moved to trash", async ({
  app,
  drive,
  page,
}) => {
  drive.addFolder({ id: "nonempty-folder", name: "Nonempty" });
  drive.addFile({
    id: "folder-child",
    name: "child.txt",
    parentId: "nonempty-folder",
  });
  drive.addFolder({ id: "empty-folder", name: "Empty" });
  await connectExplorer(page);

  await page.locator('[data-item-id="nonempty-folder"]').hover();
  await deleteButton(page, "nonempty-folder").click();
  await page.locator("#acceptConfirmationButton").click();
  await expect(page.locator("#confirmationTitle")).toHaveText(
    "FOLDER NOT EMPTY"
  );
  await expect(page.locator("#confirmationMessage")).toContainText(
    "FOR SECURITY, DELETING NON-EMPTY FOLDERS IS NOT SUPPORTED"
  );
  await expect(page.locator("#cancelConfirmationButton")).toBeHidden();
  await page.locator("#acceptConfirmationButton").click();
  expect(drive.get("nonempty-folder").trashed).not.toBe(true);

  await page.locator('[data-item-id="empty-folder"]').hover();
  await deleteButton(page, "empty-folder").click();
  await expect(page.locator("#cancelConfirmationButton")).toBeVisible();
  await page.locator("#acceptConfirmationButton").click();
  await expect(page.locator('[data-item-id="empty-folder"]')).toHaveCount(0);
  await expect(page.locator("#status")).toHaveText("FOLDER MOVED TO TRASH");
  expect(drive.get("empty-folder").trashed).toBe(true);
});

test("dirty or busy files cannot be moved to trash", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "dirty-file", name: "dirty.txt", content: "saved" });
  await connectExplorer(page);
  await page.locator('[data-item-id="dirty-file"]').click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await setEditorText(page, "unsaved");

  await page.locator('[data-item-id="dirty-file"]').hover();
  await deleteButton(page, "dirty-file").click();
  await expect(page.locator("#confirmationTitle")).toHaveText("FILE IN USE");
  await expect(page.locator("#confirmationMessage")).toContainText(
    "SAVE OR DISCARD PENDING FILE CHANGES"
  );
  await page.locator("#acceptConfirmationButton").click();
  expect(drive.get("dirty-file").trashed).not.toBe(true);
});

test("trash failure preserves the row and an active trash blocks account switching", async ({
  app,
  auth,
  drive,
  page,
}) => {
  drive.addFile({ id: "failure-file", name: "failure.txt" });
  drive.addFile({ id: "slow-trash", name: "slow.txt" });
  await connectExplorer(page);

  drive.failNextTrash("failure-file");
  await page.locator('[data-item-id="failure-file"]').hover();
  await deleteButton(page, "failure-file").click();
  await page.locator("#acceptConfirmationButton").click();
  await expect(page.locator("#status")).toContainText("TRASH FAILED");
  await expect(page.locator('[data-item-id="failure-file"]')).toBeVisible();

  drive.setTrashDelay("slow-trash", 500);
  await page.locator('[data-item-id="slow-trash"]').hover();
  await deleteButton(page, "slow-trash").click();
  await page.locator("#acceptConfirmationButton").click();
  drive.setAccount("second@example.com", "account-2");
  const requestCount = await auth.requestCount();
  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await page.locator("#switchAccountButton").click();
  await expect(page.locator("#status")).toHaveText(
    "FINISH DRIVE OPERATIONS BEFORE SWITCHING ACCOUNT"
  );
  expect(await auth.requestCount()).toBe(requestCount);
  await expect.poll(() => drive.get("slow-trash").trashed).toBe(true);
});
