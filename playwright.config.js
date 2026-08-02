const { existsSync } = require("node:fs");
const { defineConfig } = require("@playwright/test");

const systemChrome = "/usr/bin/google-chrome";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
  (existsSync(systemChrome) ? systemChrome : undefined);

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: executablePath ? { executablePath } : {},
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "python3 -m http.server 4173 --directory public",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
