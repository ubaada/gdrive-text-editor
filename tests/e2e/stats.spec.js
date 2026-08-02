const { expect, test } = require("../fixtures/app");
const { setEditorText } = require("./helpers");

test("byte statistics use readable units", async ({ app, page }) => {
  await setEditorText(page, "hello");
  await expect(page.locator("#documentStats")).toContainText("5 B");

  await setEditorText(page, "a".repeat(2048));
  await expect(page.locator("#documentStats")).toContainText("2 KB");
  await expect(page.locator("#documentStats")).not.toContainText("2048 BYTES");
});
