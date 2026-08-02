const { expect, test } = require("../fixtures/app");

test("empty tabs close without prompting and never enter recovery", async ({
  app,
  page,
}) => {
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    dialogCount += 1;
    await dialog.dismiss();
  });

  await expect(page.locator("#newButton")).toHaveCount(0);
  await expect(page.locator("#openButton")).toHaveCount(0);
  await expect(page.locator("#newTabButton")).toHaveText("+");

  await page.locator("#newTabButton").click();
  await expect(page.locator(".tab")).toHaveCount(2);
  const tabBarEdges = await page.evaluate(() => ({
    plusLeft: document.getElementById("newTabButton").getBoundingClientRect().left,
    tabsRight: document.getElementById("tabs").getBoundingClientRect().right,
  }));
  expect(Math.abs(tabBarEdges.plusLeft - tabBarEdges.tabsRight)).toBeLessThan(2);

  await page.locator('.tab[aria-selected="true"] .tab-close').click();
  await expect(page.locator(".tab")).toHaveCount(1);

  await page.locator('.tab[aria-selected="true"] .tab-close').click();
  await expect(page.locator(".tab")).toHaveCount(1);
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toContainText(
    "Untitled"
  );
  expect(dialogCount).toBe(0);

  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("drive-edit-recovery", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const transaction = request.result.transaction("drafts", "readwrite");
          transaction.objectStore("drafts").put({
            id: "legacy-empty-draft",
            name: "Untitled 1",
            content: "",
            file: null,
            updatedAt: new Date().toISOString(),
          });
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
        };
      })
  );
  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator("#recoveryDialog")).toBeHidden();
});
