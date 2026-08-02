const path = require("node:path");

const MONACO_PREFIX = "/npm/monaco-editor@0.52.2/min/";
const MONACO_ROOT = path.resolve(
  __dirname,
  "../../node_modules/monaco-editor/min"
);

const CONTENT_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".ttf": "font/ttf",
};

async function installMonacoRoute(page) {
  await page.route(
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/**",
    (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const relativePath = decodeURIComponent(pathname.split(MONACO_PREFIX)[1]);
      const filePath = path.resolve(MONACO_ROOT, relativePath);
      if (!filePath.startsWith(MONACO_ROOT)) {
        return route.abort();
      }
      return route.fulfill({
        path: filePath,
        contentType: CONTENT_TYPES[path.extname(filePath)],
      });
    }
  );
}

module.exports = { installMonacoRoute };
