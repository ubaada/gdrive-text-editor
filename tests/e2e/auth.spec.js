const { expect, test } = require("../fixtures/app");
const { setEditorText } = require("./helpers");

test("reload silently reconnects with the remembered account hint", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.lastPrompt()).toBe("consent");
  expect(await auth.lastLoginHint()).toBeUndefined();

  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await expect(page.locator("#recoveryDialog")).toBeHidden();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.lastPrompt()).toBe("none");
  expect(await auth.lastLoginHint()).toBe("test@example.com");
  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | test@example.com"
  );
});

test("failed silent reconnect offers a user-triggered Google popup", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await auth.setMode("silent_error");

  await page.reload();
  await expect(page.locator("#reconnectDialog")).toBeVisible();
  await page.locator("#connectDriveButton").click();
  await expect(page.locator("#reconnectDialog")).toBeHidden();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.lastPrompt()).toBe("");
  expect(await auth.lastLoginHint()).toBe("test@example.com");
});

test("reconnect denial keeps the remembered account", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await auth.setMode("silent_error");
  await page.reload();
  await expect(page.locator("#reconnectDialog")).toBeVisible();
  await auth.setMode("oauth_error");
  await page.locator("#connectDriveButton").click();
  await expect(page.locator("#status")).toHaveText("AUTH FAILED: access_denied");

  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "REMEMBERED | test@example.com"
  );
  await auth.setMode("silent_error");
  await page.reload();
  await expect(page.locator("#reconnectDialog")).toBeVisible();
  expect(await auth.lastLoginHint()).toBe("test@example.com");
});

test("account settings switches without reusing the previous login hint", async ({
  app,
  auth,
  drive,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  drive.setAccount("second@example.com", "account-2");

  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await page.locator("#switchAccountButton").click();

  expect(await auth.lastPrompt()).toBe("select_account");
  expect(await auth.lastLoginHint()).toBeUndefined();
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | second@example.com"
  );
});

test("failed account switching preserves the connected account", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await auth.setMode("oauth_error");

  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await page.locator("#switchAccountButton").click();

  await expect(page.locator("#status")).toHaveText("AUTH FAILED: access_denied");
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | test@example.com"
  );
  const requestCount = await auth.requestCount();
  await page.locator("#closeSettingsButton").click();
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.requestCount()).toBe(requestCount);
});

test("Drive access waits for verified account identity", async ({
  app,
  auth,
  drive,
  page,
}) => {
  drive.addFile({ id: "verified-file", name: "verified.txt" });
  drive.failNextAbout();

  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText(
    "GOOGLE ACCOUNT LOOKUP FAILED"
  );
  await expect(page.locator('[data-item-id="verified-file"]')).toHaveCount(0);

  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator('[data-item-id="verified-file"]')).toBeVisible();
  expect(await auth.requestCount()).toBe(2);
});

test("account switching waits for inline creation to finish", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await page.locator("#explorerNewFolderButton").click();
  const requestCount = await auth.requestCount();

  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await page.locator("#switchAccountButton").click();

  await expect(page.locator("#status")).toHaveText(
    "FINISH DRIVE OPERATIONS BEFORE SWITCHING ACCOUNT"
  );
  expect(await auth.requestCount()).toBe(requestCount);
  await expect(page.locator("#explorerTree .explorer-create-input")).toBeVisible();
});

test("stale explorer responses cannot overwrite a switched account", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "old-account-file", name: "old.txt" });
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator('[data-item-id="old-account-file"]')).toBeVisible();

  drive.setFolderDelaySequence("root", [300, 700]);
  await page.locator("#explorerRefreshButton").click();
  await page.waitForTimeout(50);
  drive.remove("old-account-file");
  drive.addFile({ id: "new-account-file", name: "new.txt" });
  drive.setAccount("second@example.com", "account-2");
  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await page.locator("#switchAccountButton").click();
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | second@example.com"
  );

  await page.waitForTimeout(350);
  await expect(page.locator('[data-item-id="old-account-file"]')).toHaveCount(0);
  await expect(page.locator('[data-item-id="new-account-file"]')).toBeVisible();
});

test("account switching asks before discarding unsaved Drive edits", async ({
  app,
  auth,
  drive,
  page,
}) => {
  drive.addFile({ id: "draft", name: "draft.txt", content: "saved" });
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await page.getByRole("treeitem", { name: /draft\.txt/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await setEditorText(page, "unsaved");
  drive.setAccount("second@example.com", "account-2");

  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  const requestCount = await auth.requestCount();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#switchAccountButton").click();
  expect(await auth.requestCount()).toBe(requestCount);
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toHaveText(
    "draft.txt"
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#switchAccountButton").click();
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | second@example.com"
  );
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toContainText(
    "Untitled"
  );
  expect(drive.get("draft").content).toBe("saved");
});
