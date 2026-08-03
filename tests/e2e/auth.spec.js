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
