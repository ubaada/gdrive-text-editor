const path = require("node:path");
const { expect, test } = require("../fixtures/app");
const { connectExplorer } = require("./helpers");

test.skip(!process.env.UPDATE_SCREENSHOTS, "Run with npm run screenshots");

test("capture Carbon White and Solar Sand", async ({ app, drive, page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  drive.addFolder({ id: "projects", name: "PROJECTS" });
  drive.addFolder({ id: "archive", name: "ARCHIVE", parentId: "projects" });
  drive.addFile({
    id: "plan",
    name: "plan.md",
    content: "# Release plan\n\n1. Verify editor\n2. Publish release",
    parentId: "projects",
  });
  drive.addFile({
    id: "notes",
    name: "notes.md",
    content: "# Project notes\n\nDrive-backed editing without leaving the browser.",
  });
  drive.addFile({
    id: "todo",
    name: "todo.txt",
    content: "[x] Build file explorer\n[x] Add recovery\n[ ] Ship the next release",
  });

  await connectExplorer(page);
  await page.getByRole("treeitem", { name: /PROJECTS/ }).click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");

  await page.getByRole("treeitem", { name: /notes\.md/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");
  await page.getByRole("treeitem", { name: /todo\.txt/ }).click();
  await expect(page.locator("#status")).toHaveText("LOADED");

  const untitledTab = page.locator(".tab").filter({ hasText: "Untitled" });
  page.once("dialog", (dialog) => dialog.accept());
  await untitledTab.locator(".tab-close").click();
  await expect(page.locator(".tab")).toHaveCount(2);

  await page.screenshot({
    path: path.resolve(__dirname, "../../screenshots/carbon-white.png"),
    fullPage: true,
  });

  await page.locator("#settingsButton").click();
  await page.locator("#darkModeToggle").uncheck();
  await page.locator("#lightThemeSelect").selectOption("solar-sand");
  await page.locator("#closeSettingsButton").click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 240, 214)");

  await page.screenshot({
    path: path.resolve(__dirname, "../../screenshots/solar-sand.png"),
    fullPage: true,
  });
});
