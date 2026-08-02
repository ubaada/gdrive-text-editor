const { expect } = require("../fixtures/app");

async function connectExplorer(page) {
  await page.locator("#explorerRefreshButton").click();
  await expect(page.locator("#status")).toHaveText("EXPLORER UPDATED");
}

async function setEditorText(page, text) {
  await page.locator("#editor .monaco-editor").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(text);
}

async function acceptNextDialog(page) {
  page.once("dialog", (dialog) => dialog.accept());
}

module.exports = { acceptNextDialog, connectExplorer, setEditorText };
