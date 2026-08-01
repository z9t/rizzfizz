# Plan 004: Add CI gate and sync CLI version with package.json

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- package.json src/cli.ts test/cli.test.js scripts/require-node22.mjs .nvmrc`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (ideally after 001–003 so CI protects those fixes; can land earlier)
- **Category**: dx | tests
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

There is no CI. Regressions depend on a human remembering `npm test`. Separately, `rizzfizz --version` reports `0.1.0` while `package.json` is `0.2.0`, which confuses release tracking. This plan adds a Node 22 GitHub Actions workflow for `check` + `test`, gates the machine-local real-pidge integration test so CI stays green, and syncs the CLI version to the package version.

## Current state

```json
// package.json
"version": "0.2.0",
"scripts": {
  "check": "tsc -p tsconfig.json --noEmit",
  "test": "npm run build && node --test",
  ...
},
"engines": { "node": ">=22" }
```

```ts
// src/cli.ts
program
  .name("rizzfizz")
  .description("CLI-first design intelligence utility for scrubbed website-builder briefs and OKLCH palettes.")
  .version("0.1.0");
```

```js
// test/cli.test.js — real pidge integration (will fail on clean CI hosts)
test("handoff can send through real pidge into an isolated bus root", async () => {
  // ...
  "--pidge",
  "/Users/max/Documents/Code/pidge/pidge",
  // ...
});
```

- `scripts/require-node22.mjs` already gates Node major ≥ 22.
- `.nvmrc` / `.node-version` pin `22.22.2`.
- No `.github/workflows/` directory exists today.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Version   | `npm run build && node bin/cli.js --version` | prints `0.2.0` (or package version) |

## Scope

**In scope**:

- `.github/workflows/ci.yml` (create)
- `src/cli.ts` — version wiring only
- `package.json` — only if adding a tiny script helper is cleaner (prefer reading version from package.json in cli)
- `test/cli.test.js` — gate the real-pidge test; optional assert on `--version`
- Optional: `scripts/read-package-version.mjs` — only if needed

**Out of scope**:

- ESLint/Prettier (not requested here)
- Deploy/publish workflows
- Changing pidge/Whiffler product behavior (plan 005)
- Smoke job that writes under repo `runs/` (use `/tmp` if you add smoke later)

## Git workflow

- Branch: `advisor/004-ci-and-version-sync`
- Commits: `chore: sync CLI version with package.json` / `ci: add Node 22 check and test workflow`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Sync CLI version with package.json

In `src/cli.ts`, stop hardcoding `"0.1.0"`. Preferred pattern for this ESM package:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageVersion = JSON.parse(readFileSync(packageJsonPath, "utf8")).version as string;

program.version(packageVersion);
```

Note: `src/cli.ts` already imports `readFileSync` from `node:fs` for other commands — reuse it. After compile, `import.meta.url` resolves under `dist/`, so `..` / `package.json` is the package root — confirm with a quick run.

**Verify**: `npm run build && node bin/cli.js --version` → matches `node -p "require('./package.json').version"` (e.g. `0.2.0`).

### Step 2: Gate real-pidge integration test for CI

Change `"handoff can send through real pidge into an isolated bus root"` so it:

1. Resolves pidge from `process.env.PIDGE_BIN` if set, else the current absolute default path.
2. Skips (via `test.skip` or early return with `t.skip` / checking access) when the binary is not executable — so GitHub Actions without pidge stays green.
3. Still runs on the maintainer machine when the binary exists.

Dry-run handoff tests and PATH fake-pidge tests must remain always-on.

**Verify**: `npm test` → exit 0 locally; if pidge is missing, the gated test skips and others pass.

### Step 3: Add GitHub Actions workflow

Create `.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
```

Do not require pidge or Whiffler. Do not run `npm run smoke` unless you redirect all outputs to `$RUNNER_TEMP` and accept longer runtime — default is **omit smoke** from CI for this plan.

**Verify**: YAML is valid enough that `actionlint` is optional; at minimum `test -f .github/workflows/ci.yml` and `npm test` still passes locally.

### Step 4: Optional version regression test

Add a tiny test:

```js
test("cli --version matches package.json", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const { stdout } = await execFileAsync("node", [cli, "--version"]);
  assert.match(stdout.trim(), new RegExp(pkg.version));
});
```

**Verify**: `npm test` → exit 0.

## Test plan

- Version sync test (optional but recommended).
- Real-pidge test skip behavior when binary absent (manual check: `PIDGE_BIN=/nonexistent npm test` or temporarily rename — do not break the user’s install; prefer checking `access` inside the test).
- CI file present.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `node bin/cli.js --version` equals `package.json` version
- [ ] `.github/workflows/ci.yml` exists and runs `npm ci`, `npm run check`, `npm test` on Node 22
- [ ] Real-pidge test does not fail when binary is absent
- [ ] `plans/README.md` 004 → DONE

## STOP conditions

- `import.meta.url` path to `package.json` resolves wrong from `dist/` after build — fix path; if packaging layout differs, STOP with details.
- Org/repo blocks GitHub Actions — report; leave workflow file anyway unless operator forbids.
- Gating pidge test would require rewriting half of cli.test.js — keep change minimal; STOP if scope explodes.

## Maintenance notes

- Bump `package.json` version as the single source of truth; CLI follows automatically.
- If smoke is later added to CI, keep outputs under `$RUNNER_TEMP`.
- Reviewers: ensure secrets are never printed; this workflow needs none.
