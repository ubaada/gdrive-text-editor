# Repository Guide For Agents

Read `SPEC.md` before changing product behavior. It is the canonical current
product contract.

## Maintaining SPEC.md

The user requires the specification to evolve with the application.

- Update `SPEC.md` whenever a change adds, removes, renames, or materially
  changes user-visible behavior, an interaction, a safety guarantee, a design
  preference, or an edge case.
- Treat a later explicit user requirement as superseding any conflicting older
  requirement.
- Reconcile changed requirements in place. Rewrite or remove obsolete text; do
  not append contradictory exceptions or preserve old behavior as normative.
- Keep `SPEC.md` as current truth, not a changelog. Git history is the history.
- Reconcile every affected section, label, example, edge case, and acceptance
  criterion so only one interpretation remains.
- Update implementation, regression tests, and `SPEC.md` in the same change.
- Remove or revise tests that encode superseded behavior.
- If the new requirement is ambiguous or conflicts with another requirement and
  the final behavior cannot be inferred safely, ask the user before editing the
  specification.
- Do not fill `SPEC.md` with replaceable implementation details such as DOM IDs,
  storage keys, debounce durations, API URL strings, or internal state shapes
  unless the user explicitly makes them part of the product contract.
- Do not duplicate product requirements in `AGENTS.md`; keep them in `SPEC.md`
  and reference that document instead.

## Project Overview

Drive Edit is a static browser application for editing ordinary UTF-8 text files
in Google Drive. There is no application server or build step. The browser uses
Google Identity Services and Drive API v3 directly, while Monaco provides the
editor.

Key locations:

- `public/`: production application.
- `tests/e2e/`: Playwright behavior tests.
- `tests/fixtures/`: deterministic browser/API mocks.
- `SPEC.md`: canonical product behavior.

## Development Commands

Use Node 20 or newer.

```sh
npm ci
npm test
npm run test:headed
npm run test:ui
npm run screenshots
```

## Verification Guidance

Use judgment; these are strong defaults, not an inflexible gate:

- Run focused Playwright tests while iterating, then `npm test` before completing
  behavior changes when practical.
- For changed JavaScript, run `node --check` on the affected files.
- Run `git diff --check` before completion.
- Check intentional UI changes at desktop and mobile sizes when practical.
- Run `npm run screenshots` only when intentionally updating reference images.
- Report what was tested and anything that could not be verified.

## Working Guidelines

- Import `test` and `expect` from `tests/fixtures/app`, not directly from
  Playwright.
- Never require live Google credentials, a real Drive account, or Drive network
  requests in automated tests.
- Keep test state isolated because the suite runs in parallel.
- Extend the existing fixtures when new API behavior needs coverage.
- Include failure, cancellation, stale-response, and race coverage for async
  behavior, not only successful paths.
- Prefer the smallest correct change that satisfies `SPEC.md`.
- Add or update behavior-focused Playwright coverage for regressions.
- Never commit secrets, credentials, or access tokens.
- Do not regenerate screenshots unless the visual change is intentional.
- Do not commit or push unless the user requests it.
