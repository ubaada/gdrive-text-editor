const { test: base, expect } = require("@playwright/test");
const { installDriveApi } = require("./drive-api");
const { installGoogleAuth } = require("./google-auth");
const { installMonacoRoute } = require("./monaco");

const test = base.extend({
  auth: async ({ page }, use) => {
    await use(await installGoogleAuth(page));
  },
  drive: async ({ page }, use) => {
    await use(await installDriveApi(page));
  },
  monacoRoute: async ({ page }, use) => {
    await installMonacoRoute(page);
    await use();
  },
  app: async ({ page, auth, drive, monacoRoute }, use) => {
    await page.goto("/");
    await expect(page.locator(".monaco-editor")).toBeVisible();
    await expect(page.locator(".tab")).toHaveCount(1);
    await use({ auth, drive });
  },
});

module.exports = { expect, test };
