const { expect, test } = require("../fixtures/app");
const { connectExplorer } = require("./helpers");

test("file clicks open a named loading tab immediately", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "slow", name: "slow.txt", content: "loaded content" });
  drive.setFileDelay("slow", 350);
  await connectExplorer(page);

  await page.getByRole("treeitem", { name: /slow\.txt/ }).click();
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toHaveText(
    "slow.txt"
  );
  await expect(page.locator("#editorState")).toBeVisible();
  await expect(page.locator("#editorStateMessage")).toHaveText("LOADING FILE");

  const firstFrame = await page.locator("#editorStateSymbol").textContent();
  await expect
    .poll(() => page.locator("#editorStateSymbol").textContent())
    .not.toBe(firstFrame);

  await expect(page.locator("#editorState")).toBeHidden();
  await expect(page.locator("#status")).toHaveText("LOADED");
});

test("folder expansion shows an inline animated loader", async ({
  app,
  drive,
  page,
}) => {
  drive.addFolder({ id: "slow-folder", name: "SLOW FOLDER" });
  drive.setFolderDelay("slow-folder", 350);
  await connectExplorer(page);

  await page.getByRole("treeitem", { name: /SLOW FOLDER/ }).click();
  const symbol = page.locator(".explorer-loading-symbol");
  await expect(symbol).toBeVisible();
  const firstFrame = await symbol.textContent();
  await expect.poll(() => symbol.textContent()).not.toBe(firstFrame);
  await expect(symbol).toHaveCount(0);
});
