const { expect, test } = require("../fixtures/app");
const { connectExplorer } = require("./helpers");

test("inline file and folder creation uses the selected folder", async ({
  app,
  drive,
  page,
}) => {
  const folder = drive.addFolder({ id: "docs", name: "DOCS" });
  await connectExplorer(page);
  await page.getByRole("treeitem", { name: /DOCS/ }).click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");

  await page.locator("#explorerNewFileButton").click();
  const fileInput = page.locator(".explorer-create-input");
  await expect(fileInput).toHaveValue(".txt");
  expect(await fileInput.evaluate((input) => input.selectionStart)).toBe(0);
  await expect(page.locator("#explorerNewFolderButton")).toBeDisabled();

  await fileInput.pressSequentially("notes");
  await fileInput.press("Enter");
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toHaveText(
    "notes.txt"
  );
  await expect.poll(() => drive.findByName("notes.txt")?.parents[0]).toBe(folder.id);
  const createdFileRow = page.getByRole("treeitem", { name: /notes\.txt/ });
  await expect(createdFileRow.locator(".explorer-marker")).toHaveText("");

  await page.locator("#explorerNewFolderButton").click();
  const folderInput = page.locator(".explorer-create-input");
  await expect(folderInput).toHaveValue("");
  await folderInput.fill("ARCHIVE");
  await folderInput.press("Enter");
  await expect.poll(() => drive.findByName("ARCHIVE")?.parents[0]).toBe(folder.id);
});

test("Escape and X cancel inline creation", async ({ app, page }) => {
  await page.locator("#explorerNewFileButton").click();
  await page.locator(".explorer-create-input").press("Escape");
  await expect(page.locator(".explorer-create-input")).toHaveCount(0);

  await page.locator("#explorerNewFolderButton").click();
  await page.locator(".explorer-create-cancel").click();
  await expect(page.locator(".explorer-create-input")).toHaveCount(0);
});
