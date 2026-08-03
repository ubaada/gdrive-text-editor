const { expect, test } = require("../fixtures/app");

test("font preferences apply immediately and survive reload", async ({
  app,
  page,
}) => {
  await page.locator("#settingsButton").click();
  await expect(page.locator("#uiFontSelect")).toHaveValue("gt-america-mono");
  await page.locator("#uiFontSelect").selectOption("courier-new");
  await page.locator("#uiFontSizeSelect").selectOption("18");
  await page.locator("#editorSectionButton").click();
  await expect(page.locator("#editorFontSelect")).toHaveValue(
    "gt-america-mono"
  );

  await page.locator("#editorFontSelect").selectOption("monaco");
  await page.locator("#editorFontSizeSelect").selectOption("20");

  await expect(page.locator("body")).toHaveCSS("font-size", "18px");
  expect(
    await page.evaluate(() =>
      editor.getOption(monaco.editor.EditorOption.fontSize)
    )
  ).toBe(20);

  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.locator("#settingsButton").click();
  await expect(page.locator("#uiFontSelect")).toHaveValue("courier-new");
  await expect(page.locator("#uiFontSizeSelect")).toHaveValue("18");
  await page.locator("#editorSectionButton").click();
  await expect(page.locator("#editorFontSelect")).toHaveValue("monaco");
  await expect(page.locator("#editorFontSizeSelect")).toHaveValue("20");
});

test("editor rulers apply immediately, stay unique, and survive reload", async ({
  app,
  page,
}) => {
  await page.locator("#settingsButton").click();
  await page.locator("#editorSectionButton").click();
  const input = page.locator("#rulerInput");

  await input.fill("120");
  await input.press("Enter");
  await input.fill("80");
  await input.press("Enter");
  await input.fill("80");
  await input.press("Enter");

  await expect(page.locator(".ruler-item")).toHaveCount(2);
  await expect(page.locator(".ruler-column")).toHaveText([
    "COLUMN 80",
    "COLUMN 120",
  ]);
  expect(
    await page.evaluate(() =>
      editor
        .getOption(monaco.editor.EditorOption.rulers)
        .map((ruler) => ruler.column)
    )
  ).toEqual([80, 120]);

  await page.getByRole("button", { name: "Delete ruler 80" }).click();
  expect(
    await page.evaluate(() =>
      editor
        .getOption(monaco.editor.EditorOption.rulers)
        .map((ruler) => ruler.column)
    )
  ).toEqual([120]);

  await page.reload();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.locator("#settingsButton").click();
  await page.locator("#editorSectionButton").click();
  await expect(page.locator(".ruler-column")).toHaveText("COLUMN 120");
});
