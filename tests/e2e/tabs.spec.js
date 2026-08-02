const { expect, test } = require("../fixtures/app");
const { acceptNextDialog } = require("./helpers");

test("tab bar uses a plain plus and always keeps one tab open", async ({
  app,
  page,
}) => {
  await expect(page.locator("#newButton")).toHaveCount(0);
  await expect(page.locator("#openButton")).toHaveCount(0);
  await expect(page.locator("#newTabButton")).toHaveText("+");

  await page.locator("#newTabButton").click();
  await expect(page.locator(".tab")).toHaveCount(2);

  await acceptNextDialog(page);
  await page.locator('.tab[aria-selected="true"] .tab-close').click();
  await expect(page.locator(".tab")).toHaveCount(1);

  await acceptNextDialog(page);
  await page.locator('.tab[aria-selected="true"] .tab-close').click();
  await expect(page.locator(".tab")).toHaveCount(1);
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toContainText(
    "Untitled"
  );
});
