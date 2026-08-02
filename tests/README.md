# Browser tests

The Playwright suite runs the production static app against deterministic,
in-memory Google Auth and Drive API fixtures. It does not require credentials or
make requests to Google.

```sh
npm install
npm test
npm run screenshots
```

Use `npm run test:headed` to watch the tests or `npm run test:ui` for
Playwright's interactive runner.

The Drive fixture supports folder listings, metadata and media downloads,
multipart file creation, content updates, and configurable response delays.
Monaco is served from `node_modules`, keeping the suite independent of CDN
availability.
