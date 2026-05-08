# Testing Patterns

**Analysis Date:** 2026-05-09

## Test Framework

**Runner:**
- Node built-in test runner (`node --test`) with Node >=22, enforced by `scripts/require-node22.mjs` through `pretest` in `package.json`.
- Config: Not detected; tests rely on Node defaults and `package.json` scripts.

**Assertion Library:**
- Node built-in `node:assert/strict`, used in `test/color.test.js` and `test/cli.test.js`.

**Run Commands:**
```bash
npm run check          # Type-check src/**/*.ts with strict TypeScript
npm test               # Build dist, then run node --test
npm run smoke          # Build and exercise palette + export CLI path
npm run build          # Compile TypeScript to dist/
```

## Test File Organization

**Location:**
- Tests live under `test/`, separate from `src/`.
- Fixtures live under `test/fixtures/`.
- Tests import compiled output from `dist/` or execute `bin/cli.js`; `npm test` builds before running tests.

**Naming:**
- Use `<feature>.test.js`: `test/color.test.js`, `test/cli.test.js`.
- Use fixture names that describe external artifact shape: `test/fixtures/DESIGN-source.md`, `test/fixtures/waffle-scan.json`.

**Structure:**
```text
test/
├── cli.test.js              # CLI workflow and integration tests
├── color.test.js            # Palette/color unit tests against dist/color.js
└── fixtures/
    ├── DESIGN-source.md     # Scrub source fixture with identity/URL data
    └── waffle-scan.json     # Whiffler scan fixture for tech context tests
```

## Test Structure

**Suite Organization:**
```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { buildPaletteRun } from "../dist/color.js";

test("palette run includes required tokens and no required contrast failures", () => {
  const run = buildPaletteRun({ relationship: "dark-sparse-accent", hue: "blue", variants: 4, source: "test" });
  assert.equal(run.variants.length, 4);
  assert.deepEqual(run.variants[0].checks.failures, []);
});
```

**Patterns:**
- Use top-level `test("behavior description", fn)` calls, not nested suites.
- Use `mkdtemp(join(tmpdir(), "rizzfizz-test-"))` for CLI output isolation.
- Always clean temporary directories in `finally` with `rm(dir, { recursive: true, force: true })`.
- Parse generated JSON with `JSON.parse(await readFile(..., "utf8"))` and assert schema strings, counts, and key fields.
- Execute CLI behavior with `execFileAsync("node", [cli, ...args])` rather than shell strings.

## Mocking

**Framework:** Not used

**Patterns:**
```javascript
const waffleFixture = new URL("./fixtures/waffle-scan.json", import.meta.url).pathname;
await execFileAsync("node", [cli, "tech-scan", "--input", waffleFixture, "--out", techContextPath]);
```

**What to Mock:**
- Prefer static fixtures for external scan input, as in `test/fixtures/waffle-scan.json`.
- Prefer isolated temp directories and environment overrides for filesystem-backed integrations, as in `PIDGE_ROOT: busRoot` in `test/cli.test.js`.

**What NOT to Mock:**
- Do not mock the CLI process for command tests; execute `bin/cli.js` with `execFile`.
- Do not mock generated artifact reads; inspect actual files written by the command.
- Do not hit live URLs in default tests; use `--input` fixtures for Whiffler-derived behavior.

## Fixtures and Factories

**Test Data:**
```javascript
const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;
const waffleFixture = new URL("./fixtures/waffle-scan.json", import.meta.url).pathname;
const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
```

**Location:**
- Markdown source fixture: `test/fixtures/DESIGN-source.md`.
- Whiffler JSON fixture: `test/fixtures/waffle-scan.json`.
- Runtime output fixtures should be created under OS temp directories, not committed.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
node --test --experimental-test-coverage
```

No npm coverage script or coverage threshold is configured in `package.json`.

## Test Types

**Unit Tests:**
- `test/color.test.js` covers color conversion, hue interpolation, easing, contrast ratio, and generated palette token shape against `dist/color.js`.
- Add unit tests beside this style for pure functions in `src/schemas.ts`, `src/technology.ts`, `src/scrub.ts`, and `src/pidge.ts` when behavior can be checked without running the CLI.

**Integration Tests:**
- `test/cli.test.js` covers CLI commands through `bin/cli.js`: `palette`, `scrub-md`, `export`, `tech-scan`, and `handoff`.
- Integration tests verify real output files, schema fields, source-safety redaction, generated briefs, and isolated Pidge bus behavior.

**E2E Tests:**
- No browser or Playwright E2E tests are used.
- No live network E2E tests are used by default.

## Common Patterns

**Async Testing:**
```javascript
test("palette command writes palette-run JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const out = join(dir, "palette-run.json");
    await execFileAsync("node", [cli, "palette", "--relationship", "dark-sparse-accent", "--hue", "blue", "--variants", "3", "--out", out]);
    const run = JSON.parse(await readFile(out, "utf8"));
    assert.equal(run.schema, "rizzfizz.palette-run.v1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

**Error Testing:**
```javascript
await assert.rejects(
  () => execFileAsync("node", [cli, "palette", "--variants", "0", "--out", out]),
  /Expected positive integer/
);
```

Error-path tests are a coverage gap: current tests focus on successful commands and artifact output.

## Quality Commands

```bash
npm run check          # Static type quality gate
npm test               # Build + all Node tests
npm run smoke          # Build + palette/export smoke path
```

Run `npm run check` before edits that change TypeScript types or module imports. Run `npm test` before finishing behavior changes. Run `npm run smoke` after changes to CLI packaging, `bin/cli.js`, palette output, or export formats.

## Likely Coverage Gaps

- Schema rejection paths are lightly covered: malformed `palette-run.json` cases in `src/schemas.ts` and malformed Whiffler JSON in `src/technology.ts` need `assert.throws` or `assert.rejects` tests.
- CLI error paths are lightly covered: unsupported export format, missing `--url`/`--input` for `tech-scan`, invalid variant counts, bad seed hex, and invalid Pidge agent names should be tested through `execFileAsync`.
- Palette generation is sampled only for `dark-sparse-accent`; relationship presets in `src/color.ts` should each have token/contrast assertions.
- Scrubbing tests verify one URL and one source identity fixture; add cases for email removal, clone-language replacement, multiple identity terms, proprietary font hints, and whitespace normalization in `src/scrub.ts`.
- Pidge tests cover dry-run and isolated real send, but not missing executable, invalid `--variant`, `--include-raw`, or attachment collection when optional files are absent in `src/pidge.ts`.
- Technology recommendations use one fixture. Add fixtures for CMS/ecommerce, graphics libraries, no scripts, and low-confidence detections to exercise branches in `src/technology.ts`.
- No coverage threshold exists. Use `node --test --experimental-test-coverage` manually when changing shared parser or scrub logic.

---

*Testing analysis: 2026-05-09*
