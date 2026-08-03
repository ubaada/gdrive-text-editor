const { expect, test } = require("../fixtures/app");
const { connectExplorer } = require("./helpers");

test("reload restores open Drive tabs, order, and active file", async ({
  app,
  auth,
  drive,
  page,
}) => {
  drive.addFile({ id: "alpha", name: "alpha.txt", content: "alpha" });
  drive.addFile({ id: "beta", name: "beta.txt", content: "beta" });
  await connectExplorer(page);
  await page.getByRole("treeitem", { name: /alpha\.txt/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await page.getByRole("treeitem", { name: /beta\.txt/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await page.locator(".tab-select", { hasText: "alpha.txt" }).click();

  await page.reload();

  await expect(page.locator(".tab-select")).toHaveText([
    "alpha.txt",
    "beta.txt",
  ]);
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toHaveText(
    "alpha.txt"
  );
  await expect(page.locator("#editorState")).toBeHidden();
  expect(await auth.lastPrompt()).toBe("none");
});

test("reload preserves user expansion and reveals the active file path", async ({
  app,
  drive,
  page,
}) => {
  drive.addFolder({ id: "folder-a", name: "A" });
  drive.addFolder({ id: "folder-b", name: "B" });
  drive.addFolder({ id: "nested", name: "NESTED", parentId: "folder-a" });
  drive.addFile({
    id: "deep-file",
    name: "deep.txt",
    content: "deep",
    parentId: "nested",
  });
  await connectExplorer(page);

  await page.locator('[data-item-id="folder-a"]').click();
  await expect(page.locator('[data-item-id="nested"]')).toBeVisible();
  await page.locator('[data-item-id="nested"]').click();
  await expect(page.locator('[data-item-id="deep-file"]')).toBeVisible();
  await page.locator('[data-item-id="folder-b"]').click();
  await page.locator('[data-item-id="deep-file"]').click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await expect(page.locator('[data-item-id="deep-file"]')).toHaveClass(
    /active-file/
  );

  await page.locator('[data-item-id="folder-a"]').click();
  await expect(page.locator('[data-item-id="deep-file"]')).toBeHidden();
  await page.locator('.tab[aria-selected="true"] .tab-select').click();
  await expect(page.locator('[data-item-id="deep-file"]')).toBeVisible();
  await page.locator('[data-item-id="folder-b"]').click();
  await page.locator('[data-item-id="folder-b"]').click();

  await page.reload();

  await expect(page.locator('[data-item-id="deep-file"]')).toBeVisible();
  await expect(page.locator('[data-item-id="deep-file"]')).toHaveAttribute(
    "aria-current",
    "true"
  );
  await expect(page.locator('[data-item-id="folder-b"]')).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(page.locator('[data-item-id="folder-b"]')).toHaveClass(/selected/);
});

test("reload preserves a collapsed My Drive root", async ({ app, page }) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await page.locator('[data-item-id="root"]').click();
  await expect(page.locator('[data-item-id="root"]')).toHaveAttribute(
    "aria-expanded",
    "false"
  );

  await page.reload();
  await expect(page.locator('[data-item-id="root"]')).toHaveAttribute(
    "aria-expanded",
    "false"
  );
});

test("active-file reveal does not save derived root expansion", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "root-file", name: "root.txt" });
  await page.locator("#explorerRefreshButton").click();
  await page.locator('[data-item-id="root-file"]').click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await page.locator('[data-item-id="root"]').click();
  await expect(page.locator('[data-item-id="root"]')).toHaveAttribute(
    "aria-expanded",
    "false"
  );

  await page.locator('.tab[aria-selected="true"] .tab-select').click();
  await expect(page.locator('[data-item-id="root"]')).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  const rootExpanded = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("drive-edit-workspace:")
    );
    return JSON.parse(localStorage.getItem(key)).rootExpanded;
  });
  expect(rootExpanded).toBe(false);
});

test("refresh falls back when the selected folder was deleted", async ({
  app,
  drive,
  page,
}) => {
  drive.addFolder({ id: "deleted-folder", name: "Deleted" });
  await page.locator("#explorerRefreshButton").click();
  await page.locator('[data-item-id="deleted-folder"]').click();
  drive.remove("deleted-folder");

  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator('[data-item-id="deleted-folder"]')).toHaveCount(0);
  await expect(page.locator('[data-item-id="root"]')).toHaveClass(/selected/);
});

test("temporary restoration failure does not overwrite explorer state", async ({
  app,
  drive,
  page,
}) => {
  drive.addFolder({ id: "saved-folder", name: "Saved" });
  await page.locator("#explorerRefreshButton").click();
  await page.locator('[data-item-id="saved-folder"]').click();
  await expect(page.locator('[data-item-id="saved-folder"]')).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  drive.failNextFolderList("root");

  await page.reload();
  await expect(page.locator("#status")).toHaveText("Folder list failed");
  const savedWorkspace = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("drive-edit-workspace:")
    );
    return JSON.parse(localStorage.getItem(key));
  });
  expect(savedWorkspace.selectedFolderId).toBe("saved-folder");
  expect(savedWorkspace.expandedFolderIds).toContain("saved-folder");

  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator('[data-item-id="saved-folder"]')).toHaveClass(
    /selected/
  );
  await expect(page.locator('[data-item-id="saved-folder"]')).toHaveAttribute(
    "aria-expanded",
    "true"
  );
});
