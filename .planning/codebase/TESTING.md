# Testing Patterns

**Analysis Date:** 2026-05-09

## Test Framework

**Runner:**
- Node.js built-in test runner (`node --test`)
- Config: no separate test config file detected
- Tests run against compiled JavaScript in `dist/`, so `npm test` runs `npm run build` first in `package.json:16`.

**Assertion Library:**
- `node:assert/strict`, imported as `assert` in `test/color.test.js:1` and `test/cli.test.js:1`.

**Run Commands:**
```bash
npm test             # Build with tsc, then run all node:test files
npm run check        # TypeScript no-emit check
npm run build        # Compile TypeScript to dist/
npm run smoke        # Build, generate a palette JSON, then export a-eyes tokens
```

**Node Requirement:**
- All quality commands are guarded by `scripts/require-node22.mjs` through `prebuild`, `precheck`, `pretest`, and `presmoke` in `package.json:10`.
- `package.json:27` declares `node >=22`.

## Test File Organization

**Location:**
- Tests live in the top-level `test/` directory.
- Fixtures live in `test/fixtures/`.
- Source tests import `../dist/*.js`, not `../src/*.ts`; run `npm run build` before invoking `node --test` directly.

**Naming:**
- Use `*.test.js` filenames: `test/color.test.js`, `test/cli.test.js`.
- Name tests with behavior-oriented sentences, such as `palette command writes palette-run JSON` in `test/cli.test.js:14`.

**Structure:**
```text
test/
├── color.test.js              # Pure palette/color behavior tests against dist/color.js
├── cli.test.js                # CLI integration tests through bin/cli.js
└── fixtures/
    ├── DESIGN-source.md       # Design Markdown source fixture for scrub-md
    └── waffle-scan.json       # Waffle Whiffler JSON fixture for tech-scan
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
  for (const variant of run.variants) {
    assert.deepEqual(variant.checks.failures, []);
  }
});
```

**Patterns:**
- Use one `test()` per user-visible behavior or pure algorithm behavior.
- For pure module tests, import compiled functions from `dist/` and assert exact properties or regex patterns, as in `test/color.test.js:5`.
- For CLI integration tests, execute `node bin/cli.js ...` with `execFile`, read generated files, and assert artifact schema fields/content, as in `test/cli.test.js:18`.
- Use `try/finally` cleanup for temporary directories in every filesystem integration test, as in `test/cli.test.js:14`.
- Assert schema/version strings for generated JSON artifacts, such as `rizzfizz.palette-run.v1` and `rizzfizz.technology-context.v1`.

## Mocking

**Framework:** Not used

**Patterns:**
```javascript
const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;
const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;

const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
try {
  await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", dir]);
  const variants = JSON.parse(await readFile(join(dir, "variants-palette.json"), "utf8"));
  assert.equal(variants.variants.length, 2);
} finally {
  await rm(dir, { recursive: true, force: true });
}
```

**What to Mock:**
- Prefer fixtures over mocks for external input formats. `test/fixtures/waffle-scan.json` stands in for Waffle Whiffler output in `test/cli.test.js:67`.
- Prefer isolated environment variables over mocks for local tools that write state. The Pidge integration test sets `PIDGE_ROOT` to a temp bus directory in `test/cli.test.js:139`.
- Use `--dry-run` modes for command construction and payload assertions when available, as in the Pidge handoff dry-run test at `test/cli.test.js:87`.

**What NOT to Mock:**
- Do not mock the CLI process for command behavior; invoke `bin/cli.js` through `execFile` so Commander option parsing, stdout, generated files, and exit behavior are exercised together.
- Do not mock filesystem writes for artifact workflows; tests should inspect actual output files under `mkdtemp` directories.
- Do not mock pure color calculations; assert deterministic outputs, regex formats, contrast thresholds, and no required failures directly.

## Fixtures and Factories

**Test Data:**
```javascript
const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;
const waffleFixture = new URL("./fixtures/waffle-scan.json", import.meta.url).pathname;
```

**Location:**
- `test/fixtures/DESIGN-source.md`: source Design Markdown fixture used by `scrub-md` CLI tests.
- `test/fixtures/waffle-scan.json`: Waffle Whiffler scan fixture used by `tech-scan` and `scrub-md --tech-scan` tests.

**Factory Pattern:**
- There are no shared fixture factory helpers.
- For generated test data, build it inline with production APIs where practical, such as `buildPaletteRun({ relationship, hue, variants, source })` in `test/color.test.js:30`.
- For CLI integration artifacts, create a fresh temp directory per test with `mkdtemp(join(tmpdir(), "rizzfizz-test-"))`.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
node --test --experimental-test-coverage
```

**Coverage Notes:**
- No `coverage` npm script exists in `package.json`.
- No coverage thresholds or reports are configured.
- The current test suite covers core color transformations, palette generation, CLI artifact generation, tech scan fixture summarization, and Pidge handoff happy paths.

## Test Types

**Unit Tests:**
- `test/color.test.js` covers pure color and palette generation behavior:
  - hex parsing and OKLCH conversion at `test/color.test.js:5`
  - hue interpolation wraparound at `test/color.test.js:11`
  - easing behavior at `test/color.test.js:20`
  - WCAG contrast ratio calculations at `test/color.test.js:25`
  - palette token presence and contrast failure checks at `test/color.test.js:30`

**Integration Tests:**
- `test/cli.test.js` covers CLI flows by executing `bin/cli.js`:
  - `palette` writes palette-run JSON at `test/cli.test.js:14`
  - `scrub-md` writes private and builder-facing artifacts while removing source identity from public outputs at `test/cli.test.js:27`
  - `export` writes a-eyes tokens, CSS vars, and agent briefs at `test/cli.test.js:47`
  - `tech-scan` summarizes Whiffler JSON and carries context into briefs at `test/cli.test.js:67`
  - `handoff` creates dry-run Pidge payloads at `test/cli.test.js:87`
  - `handoff` sends through a real Pidge executable with isolated `PIDGE_ROOT` at `test/cli.test.js:120`

**E2E Tests:**
- No browser or Playwright E2E tests are present.
- The CLI smoke path in `package.json:17` is the closest end-to-end check. It builds, generates `/tmp/rizzfizz-smoke-palette.json`, then exports `/tmp/rizzfizz-smoke-aeyes.json`.

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
test("invalid palette schema is rejected", () => {
  assert.throws(
    () => paletteRunSchema.parse({ schema: "wrong", variants: [] }),
    /palette run schema/
  );
});
```

The example above is the preferred style for new negative-path tests. Current tests do not include `assert.throws` or rejected-promise coverage.

## Likely Coverage Gaps

**Schema validation failures:**
- What's not tested: invalid palette-run objects, bad hex colors, missing fields, invalid enum values, malformed Whiffler scans.
- Files: `src/schemas.ts`, `src/technology.ts`
- Risk: malformed input could produce unclear errors or partial artifacts.
- Priority: High when changing schema or import/export behavior.

**CLI failure paths:**
- What's not tested: missing required files, unsupported export format, invalid `--variants`, missing `--url`/`--input` for `tech-scan`, missing Pidge/Whiffler executables.
- Files: `src/cli.ts`, `src/pidge.ts`, `src/technology.ts`
- Risk: user-facing CLI errors can regress without failing tests.
- Priority: High for CLI option or external-tool changes.

**Scrub/privacy edge cases:**
- What's not tested directly: email removal, multiple URL shapes, identity terms extracted from paths and URLs, clone-language replacement variants, short identity term handling.
- Files: `src/scrub.ts`
- Risk: builder-facing artifacts may leak source identity or over-scrub useful neutral content.
- Priority: High for scrub logic changes.

**Artifact shape depth:**
- What's not tested: full JSON structure for `scrubbed-design-dna.json`, `design-md-variation-run.json`, `tokens.css` completeness, per-variant builder brief content beyond a few strings.
- Files: `src/scrub.ts`, `src/exports.ts`, `src/color.ts`
- Risk: downstream agents may receive incomplete or incompatible artifacts.
- Priority: Medium.

**External command boundaries:**
- What's not tested: Whiffler timeout arguments, aggressive scan flag, `execFile` failures, stdout that is not JSON, large output handling, Pidge command quoting for summaries/context hints with spaces.
- Files: `src/technology.ts`, `src/pidge.ts`
- Risk: local integrations fail in real workflows even if fixture tests pass.
- Priority: Medium.

**Relationship/hue matrix:**
- What's not tested: all palette relationship presets, all hue families, variant clamping to 1..12, default normalization for unknown relationship/hue values.
- Files: `src/color.ts`
- Risk: less common palette options can drift or generate weak contrast.
- Priority: Medium.

---

*Testing analysis: 2026-05-09*
