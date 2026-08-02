const { expect, test } = require("../fixtures/app");

test("reload reuses prior Drive consent without forcing the consent prompt", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.lastPrompt()).toBe("consent");

  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator("#recoveryDialog")).toBeVisible();
  await page.locator("#closeRecoveryButton").click();
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.lastPrompt()).toBe("");
});
