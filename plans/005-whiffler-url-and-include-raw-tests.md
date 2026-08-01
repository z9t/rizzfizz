# Plan 005: Whiffler discovery/URL allowlist and include-raw handoff tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/technology.ts src/cli.ts src/pidge.ts test/cli.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pairs well after 004 so CI stays green)
- **Category**: correctness | security | tests
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

`tech-scan --url` / `scrub-md --tech-url` default Whiffler to a machine-local absolute path and pass the URL to a subprocess with no `http:`/`https:` check. Clean machines fail discovery; untrusted URL schemes are an unnecessary trust-boundary hole for a local CLI that may later be wrapped. Separately, Pidge handoff’s `--include-raw` privacy gate is implemented but untested — default exclusion of `raw-reference.json` is a critical source-safe contract with no regression signal.

## Current state

```ts
// src/technology.ts
const DEFAULT_WHIFFLER = "/Users/max/Documents/Code/whiffler/src/cli/whiffler.js";

export async function runWhiffler(options: {
  url: string;
  aggressive?: boolean;
  timeout?: number;
  executable?: string;
}): Promise<WaffleScan> {
  const executable = options.executable || DEFAULT_WHIFFLER;
  await access(executable);
  const args = [executable, "--json"];
  // ...
  args.push(options.url);
  const { stdout } = await execFileAsync("node", args, { maxBuffer: 1024 * 1024 * 10 });
  return waffleScanSchema.parse(JSON.parse(stdout));
}
```

```ts
// src/cli.ts — defaults duplicate the absolute path
.option("--whiffler <path>", "Whiffler CLI path", "/Users/max/Documents/Code/whiffler/src/cli/whiffler.js")
```

```ts
// src/pidge.ts — include-raw gate
async function collectAttachments(inputDir: string, variantIds: string[], includeRaw: boolean): Promise<string[]> {
  const candidates = [ /* ... source-safe files ... */ ];
  if (includeRaw) candidates.push(join(inputDir, "raw-reference.json"));
  // ...
}
```

```js
// test/cli.test.js — dry-run asserts metadata false, never checks attachments / --include-raw
assert.equal(payload.source.raw_reference_included, false);
```

Fixture-based tech-scan tests already cover `--input` JSON paths and must keep passing without a real Whiffler binary.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| URL reject probe | `npm run build && node bin/cli.js tech-scan --url 'file:///etc/passwd' --out /tmp/x.json ; echo exit:$?` | non-zero exit; error mentions http/https |

## Scope

**In scope**:

- `src/technology.ts` — resolve Whiffler executable; validate URL before exec
- `src/cli.ts` — default `--whiffler` wiring; optional shared helper import
- `src/pidge.ts` — only if needed to expose attachment list for testing (prefer asserting via dry-run stdout `--attach` lines without changing production API)
- `test/cli.test.js` — include-raw tests; URL validation tests; optional fake-whiffler PATH test
- Brief README note **only if** you already touch README for env vars — otherwise document env vars in a short comment near the resolver (prefer not expanding docs scope; a one-paragraph README under “Waffle Whiffler” is allowed)

**Out of scope**:

- Changing technology-context schema
- Attaching tech-context by default policy change (separate finding)
- Real network Whiffler scans in CI
- Pidge PATH bugs already fixed

## Git workflow

- Branch: `advisor/005-whiffler-url-and-include-raw-tests`
- Commits: `fix: resolve Whiffler via env/PATH and allowlist http(s)` / `test: cover handoff --include-raw privacy gate`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: URL allowlist

Add `assertHttpUrl(url: string): string` in `src/technology.ts` (or small helper module):

- `new URL(url)` must succeed
- `protocol` must be `http:` or `https:`
- Otherwise throw `Error` with message like `tech URL must be http(s), got …`

Call it at the start of `runWhiffler` before `access`/`execFile`.

Also call from CLI when `--tech-url` / `--url` is present **or** rely solely on `runWhiffler` — one place is enough if all URL scans go through it.

**Verify**:

```bash
npm run build
node bin/cli.js tech-scan --url 'file:///tmp/x' --out /tmp/rf-tech.json 2>&1 | head
```

→ exits non-zero; message mentions http/https. Do not create the out file with real scan content.

### Step 2: Resolve Whiffler executable

Replace hardcoded default with resolution order:

1. Explicit `options.executable` / CLI `--whiffler` when user passes it
2. `process.env.RIFF_WHIF_BIN` if set
3. `process.env.WHIFFLER_BIN` if set (optional alias)
4. `whiffler` on `PATH` — for a Node script entry, you may resolve via `which`-like search **or** document that default is the string `whiffler` and rely on `node` + path: today the code runs `execFile("node", [executable, ...])`, so the executable must be a **JS file path**, not a bare bin name, unless you change the spawn strategy.

**Important:** Current spawn is `execFile("node", [executable, "--json", url])`. Keep that contract. Resolution must yield a filesystem path to the Whiffler CLI JS file.

Practical approach matching Pidge’s simpler command spawn:

- Prefer: if resolved path ends up needing `node`, keep current pattern.
- Default when no env/flag: try in order:
  1. `RIFF_WHIF_BIN`
  2. Legacy path `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js` **only if `access` succeeds** (dev convenience)
  3. Else throw a clear Error telling the user to pass `--whiffler <path>` or set `RIFF_WHIF_BIN`

Do **not** leave the legacy absolute path as an unconditional Commander default string that appears in `--help` on every machine. Change CLI defaults to `undefined` / omit default and let `runWhiffler` resolve.

**Verify**: `npm run check` → 0; fixture-based tech-scan tests still pass (`--input`, no URL).

### Step 3: Tests for URL validation and optional fake Whiffler

In `test/cli.test.js`:

1. `tech-scan --url file:///…` (or `javascript:…`) rejects without spawning.
2. Optional: create a temp fake whiffler JS file that prints fixture JSON to stdout; set `RIFF_WHIF_BIN` to it; run `tech-scan --url https://example.com --out …` and assert technology-context schema. This proves discovery + http URL path without real Whiffler.

**Verify**: `npm test` → 0.

### Step 4: Handoff `--include-raw` tests

Extend dry-run handoff coverage (model after `"handoff writes a Pidge payload in dry-run mode"`):

**Default (no flag):**

- `payload.source.raw_reference_included === false`
- Parsed `command` / stdout must **not** include an `--attach` path ending in `raw-reference.json`
- Prefer also importing `sendPidgeHandoff` from `../dist/pidge.js` and asserting `result.attachments` every path `!endsWith("raw-reference.json")` — more reliable than parsing stdout

**With `--include-raw`:**

- `raw_reference_included === true`
- Attachments **include** `raw-reference.json`
- Still use `--dry-run` so no real pidge send is required

**Verify**: `npm test` → 0; both new tests listed in output.

## Test plan

- URL scheme rejection
- Fake Whiffler via `RIFF_WHIF_BIN` (recommended)
- include-raw false/true attachment assertions
- Pattern: existing handoff dry-run + tech-scan fixture tests in `test/cli.test.js`

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `rg -n 'DEFAULT_WHIFFLER = "/Users/max' src/` returns no matches **or** the constant is only used after `access` succeeds as a fallback (not as Commander’s unconditional default)
- [ ] Non-http(s) tech URLs fail fast
- [ ] include-raw default excludes raw-reference attachment; flag includes it
- [ ] `plans/README.md` 005 → DONE

## STOP conditions

- Changing spawn from `node <jsfile>` to bare binary requires Whiffler packaging knowledge you don’t have — keep JS-file resolution; STOP if product owner requires bare `whiffler` bin without a path.
- Fake Whiffler stdout contract unclear — use existing `test/fixtures/waffle-scan.json` contents as the fake’s print payload.
- Double verification failure / drift.

## Maintenance notes

- Document `RIFF_WHIF_BIN` in README when someone next edits the Whiffler section.
- Reviewers: ensure errors never print secrets; URL validation errors can echo the rejected scheme/URL (user-supplied).
- CI (plan 004) should remain green without Whiffler installed.
