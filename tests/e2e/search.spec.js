const { expect, test } = require("../fixtures/app");

test("filename search covers all Drive and opens the selected result", async ({
  app,
  drive,
  page,
}) => {
  drive.addFolder({ id: "search-folder", name: "Archive" });
  drive.addFile({
    id: "nested-notes",
    name: "meeting-notes.txt",
    content: "agenda",
    parentId: "search-folder",
  });
  drive.setFileDelay("nested-notes", 300);
  drive.addFile({ id: "other-file", name: "report.txt", content: "notes" });
  drive.addSharedDrive("team-drive", "Team Drive");
  drive.addFile({
    id: "shared-notes",
    name: "shared-notes.txt",
    content: "shared",
    driveId: "team-drive",
  });
  drive.setSearchPageSize(1);
  drive.addFile({
    id: "native-doc",
    name: "notes document",
    mimeType: "application/vnd.google-apps.document",
  });

  expect(await page.locator("header button").allTextContents()).toEqual([
    "[=]",
    "[S] SAVE",
    "[P] SEARCH",
    "[G] SETTINGS",
  ]);
  await page.locator("#searchButton").click();
  await expect(page.locator("#searchPanel")).toBeVisible();
  await expect(page.locator("#searchInput")).toBeFocused();
  await page.locator("#searchInput").fill("notes");

  await expect(page.locator(".search-result")).toHaveCount(2);
  await expect(page.locator(".search-result-name")).toHaveText([
    "meeting-notes.txt",
    "shared-notes.txt",
  ]);
  expect(drive.searchQueries().at(-1)).toContain("name contains 'notes'");
  await page.locator("#searchInput").press("Enter");
  await expect(page.locator("#searchPanel")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.activeElement.closest("#searchPanel") === null
    )
  ).toBe(true);
  await expect(page.locator('.tab[aria-selected="true"] .tab-select')).toHaveText(
    "meeting-notes.txt"
  );
  await expect(page.locator("#status")).toHaveText("LOADED");
});

test("shortcuts open and switch Drive search modes", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({
    id: "content-match",
    name: "journal.txt",
    content: "a hidden needle appears here",
  });

  await page.keyboard.press("Control+Shift+F");
  await expect(page.locator("#searchPanel")).toBeVisible();
  await expect(page.locator("#contentSearchMode")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.locator("#searchInput").fill("hidden needle");
  await expect(page.locator(".search-result-name")).toHaveText("journal.txt");
  const contentQuery = drive.searchQueries().at(-1);
  expect(contentQuery).toContain("fullText contains 'hidden'");
  expect(contentQuery).toContain("fullText contains 'needle'");

  await page.keyboard.press("Control+/");
  await expect(page.locator("#filenameSearchMode")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator(".search-result")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#searchPanel")).toBeHidden();

  await page.keyboard.press("Control+P");
  await expect(page.locator("#searchPanel")).toBeVisible();
  await expect(page.locator("#filenameSearchMode")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("#searchInput")).toHaveValue("");
});

test("search ignores stale responses, closes safely, and recovers from failure", async ({
  app,
  drive,
  page,
}) => {
  drive.addFile({ id: "slow-file", name: "slow.txt" });
  drive.addFile({ id: "fast-file", name: "fast.txt" });
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  drive.setSearchDelay("slow", 500);

  await page.keyboard.press("Control+P");
  await page.locator("#searchInput").fill("slow");
  await expect.poll(() => drive.searchQueries().length).toBe(1);
  await page.locator("#searchInput").fill("fast");
  await expect(page.locator(".search-result-name")).toHaveText("fast.txt");
  await page.waitForTimeout(550);
  await expect(page.locator(".search-result-name")).toHaveText("fast.txt");

  drive.failNextSearch();
  await page.locator("#searchInput").fill("failure");
  await expect(page.locator(".search-message")).toHaveText("SEARCH FAILED");
  await page.locator("#searchInput").fill("fast");
  await expect(page.locator(".search-result-name")).toHaveText("fast.txt");

  drive.setSearchDelay("slow", 500);
  const requestCount = drive.searchQueries().length;
  await page.locator("#searchInput").fill("slow");
  await expect.poll(() => drive.searchQueries().length).toBe(requestCount + 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(550);
  await expect(page.locator("#searchPanel")).toBeHidden();
});

test("search panel stays within a mobile viewport", async ({ app, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Control+P");
  const panel = await page.locator("#searchPanel").boundingBox();

  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(390);
  expect(panel.y + panel.height).toBeLessThanOrEqual(844);
});

test("an old-account search response cannot disconnect a switched account", async ({
  app,
  auth,
  drive,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  drive.setSearchDelay("expired", 400);
  drive.failSearch("expired", 401);
  await page.keyboard.press("Control+P");
  await page.locator("#searchInput").fill("expired");
  await expect.poll(() => drive.searchQueries().length).toBe(1);

  drive.setAccount("second@example.com", "account-2");
  await page.locator("#settingsButton").click();
  await page.locator("#accountSectionButton").click();
  await page.locator("#switchAccountButton").click();
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | second@example.com"
  );
  await page.waitForTimeout(450);
  await expect(page.locator("#googleAccountValue")).toHaveText(
    "CONNECTED | second@example.com"
  );

  const requestCount = await auth.requestCount();
  await page.locator("#closeSettingsButton").click();
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  expect(await auth.requestCount()).toBe(requestCount);
});

test("a reconnect prompt closes search and receives Escape", async ({
  app,
  auth,
  page,
}) => {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
  await auth.setMode("silent_error");
  await auth.setDelay(300);

  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.keyboard.press("Control+P");
  await expect(page.locator("#searchPanel")).toBeVisible();
  await expect(page.locator("#reconnectDialog")).toBeVisible();
  await expect(page.locator("#searchPanel")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#reconnectDialog")).toBeHidden();
});
