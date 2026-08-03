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
