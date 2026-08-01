# Plan 001: Redact source paths in builder artifacts and fix design-md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/scrub.ts src/contract.ts src/designmd.ts src/cli.ts src/exports.ts src/visual.ts src/types.ts test/cli.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security | bug
- **Planned at**: commit `b506740`, 2026-07-31
- **Execution**: DONE (APPROVE WITH NITS) on branch `advisor/001-path-redaction-and-design-md-fixes` @ `626e1ea` — 2026-07-31. Nits: executor could not create sibling worktree (sandbox); implemented on branch in main checkout. `displayNameFromSource` treats any `/` as filesystem path (low risk for current locators).

## Why this matters

RizzFizz’s product promise is source-safe builder artifacts. Today `scrub-md` writes absolute input filesystem paths into builder-facing JSON (`palette-run.source`, `source_reference_ids`, `variants-palette.json`, `visual-tokens.json`) and into `design-md` defaults. Sharing a run folder or Pidge attachment can leak usernames and project layout. Separately, `design-md` is broken in two ways: it looks for scrubbed prose under a non-existent `scrubbed/` subdirectory, and `--tech-context` embeds the path string instead of reading the file. After this plan, builder-facing artifacts use opaque locators (like Brief Weaver already does), and `design-md` works as documented.

## Current state

- `src/scrub.ts` — scrub-md orchestration; writes absolute `sourcePath` into palette run and variation run; `buildRawReference` sets `source_locator: resolve(sourcePath)`; DNA copies that into `source_reference_ids`.
- `src/contract.ts` — `buildBuildContract` copies `rawReference.source_locator` into builder-facing `source_reference_ids`.
- `src/exports.ts` / `src/visual.ts` — propagate `run.source` into builder exports.
- `src/designmd.ts` — DESIGN.md exporter; wrong prose path; tech context not read.
- `src/cli.ts` — wires `design-md --tech-context` as a path string into `exportDesignMd`.
- Exemplar of opaque locators already in repo: `src/brief-weaver.ts` uses `source_locator: \`brief-weaver:${runId}\``.

Relevant excerpts as of `b506740`:

```ts
// src/scrub.ts — palette source and variation run use absolute sourcePath
const paletteRun = buildPaletteRun({
  relationship,
  hue,
  variants: options.variants,
  source: sourcePath
});
// ...
const variationRun = {
  schema: "rizzfizz.design-md-variation-run.v1",
  source_design_md: sourcePath,
  // ...
};

// src/scrub.ts — buildRawReference
source_locator: resolve(sourcePath),

// src/scrub.ts — buildDesignDna
source_reference_ids: [rawReference.source_locator],

// src/contract.ts
source_reference_ids: [options.rawReference.source_locator],

// src/exports.ts
source_palette_run: run.source,

// src/visual.ts
source_palette_run: run.source,

// src/designmd.ts — defaults leak run.source; prose path wrong; techContext raw
const name = options.name || (sourceName ? basename(sourceName) : "Design System");
const description = options.description || `Generated from ${run.source || "RizzFizz palette run"}.`;
// ...
scrubbedProse = await readFile(join(options.input, "scrubbed", "DESIGN-neutral.md"), "utf-8");
// empty catch swallows miss
// ...
if (options.techContext) {
  lines.push(options.techContext); // path string today
}

// src/cli.ts design-md action
techContext: options.techContext, // path from --tech-context, unread
```

Conventions to match:

- ESM TypeScript under `src/`, compiled to `dist/` via `tsc`; tests import CLI via `bin/cli.js` and use `node:test` + `node:assert/strict` (see `test/cli.test.js`).
- Error handling: throw `Error` with a clear message; CLI prints `rizzfizz: ${message}` and sets `process.exitCode = 1` (`src/cli.ts` bottom).
- Commit style observed: short imperative / conventional-ish (`feat: …`, `Improve …`).

Product vocabulary (from README): builder-facing artifacts must be **source-safe**; `raw-reference.json` is **private**. Do not forward absolute source paths into builder-facing fields.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0; all tests pass |
| Single CLI probe | `npm run build && node bin/cli.js scrub-md --input test/fixtures/DESIGN-source.md --variants 1 --out /tmp/rizzfizz-001-path && node -e "const p=require('fs').readFileSync('/tmp/rizzfizz-001-path/palette-run.json','utf8'); if(p.includes('/Users/')) process.exit(1)"` | exit 0 (no `/Users/` in palette-run) |

## Scope

**In scope** (the only files you should modify):

- `src/scrub.ts`
- `src/contract.ts` — only if still copying absolute locators after scrub change (prefer fixing at `buildRawReference` so contract stays as-is)
- `src/designmd.ts`
- `src/cli.ts` — `design-md` command only (read tech-context file before calling `exportDesignMd`)
- `src/exports.ts` — only if needed for safe defaults when `run.source` is already opaque (likely no change)
- `src/visual.ts` — only if needed (likely no change once `run.source` is opaque)
- `test/cli.test.js` — add/extend tests for path redaction and `design-md`
- Optionally create `src/source-locator.ts` if a tiny shared helper keeps scrub + designmd clearer (allowed)

**Out of scope** (do NOT touch):

- Changing `run-manifest.json` absolute *output* paths under the run directory (deferred; different concern).
- Expanding scrub identity heuristics (plan 002) or removing `summarize()` prose leak (plan 003).
- Whiffler PATH / URL validation (plan 005).
- Schema expansion beyond what these fixes require (plan 006).
- `src/pidge.ts` `run_dir` absolute paths in handoff payloads.
- README / archive docs (unless a one-line comment in code is needed).

## Git workflow

- Branch: `advisor/001-path-redaction-and-design-md-fixes`
- Commit per logical unit; message style like: `fix: redact source paths in builder artifacts` / `fix: design-md prose path and tech-context`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add opaque source-safe locator helper

In `src/scrub.ts` (or new `src/source-locator.ts`), add a pure helper:

```ts
export function sourceSafeDesignMdLocator(sourcePath: string): string {
  return `design-md:${basename(sourcePath)}`;
}
```

In `buildRawReference`:

- Set `source_locator` to `sourceSafeDesignMdLocator(sourcePath)` (opaque — same pattern as Brief Weaver’s `brief-weaver:${runId}`).
- Store the absolute path only under private provenance, e.g. `provenance.local_source_path: resolve(sourcePath)` (and keep existing `tool` / `command` keys).

In `scrubDesignMarkdown`:

- Compute `const safeSource = sourceSafeDesignMdLocator(sourcePath)`.
- Pass `source: safeSource` into `buildPaletteRun`.
- Set `variationRun.source_design_md` to `safeSource` (not `sourcePath`).

Because DNA and contract already use `rawReference.source_locator` / `source_reference_ids`, they inherit the opaque id once `buildRawReference` changes.

**Verify**: `npm run check` → exit 0.

### Step 2: Fix design-md prose path and name/description defaults

In `src/designmd.ts` `exportDesignMd`:

1. Try reading prose in this order:
   - `join(options.input, "DESIGN-neutral.md")` (current scrub-md write location)
   - `join(options.input, "scrubbed", "DESIGN-neutral.md")` (Brief Weaver-shaped fallback)
2. Apply the existing strip/cleanup regexes only when a file was read.
3. Do not leave a bare empty `catch {}` without at least trying both paths; empty string prose is OK if neither exists.
4. Change defaults so absolute paths never appear:
   - `name`: `options.name || (isAbsolutePathLike(run.source) ? "Design System" : basename(run.source) || "Design System")` — or simpler: if `run.source` starts with `design-md:`, strip prefix for display; if it looks like an absolute/relative filesystem path (`/` or contains `\`), use `"Design System"`.
   - `description`: default to something like `Generated by RizzFizz from a source-safe palette run.` — never interpolate `run.source` when it could be a filesystem path. Prefer: `Generated by RizzFizz (${run.relationship}, ${run.hue_family}).` using palette fields.
5. Neutral export name: `options.name || "Design System Neutral"` (or relationship-based), not `` `${run.source} Neutral` ``.

**Verify**: `npm run check` → exit 0.

### Step 3: Make `--tech-context` read and summarize the file

In `src/cli.ts` `design-md` action:

- If `options.techContext` is set, `resolve` it, `readFile` / `readJson` it.
- Validate it is an object with `schema === "rizzfizz.technology-context.v2"` (or at least `source_safe === true` and `recommendations`); on failure throw a clear Error.
- Format a short markdown block for the body (stack_fit, top detected names, do_not_clone bullets). Do **not** dump raw JSON wholesale if it is huge; a compact summary is enough.
- Pass the formatted markdown string into `exportDesignMd` as `techContext`.

Alternatively implement the read+format inside `exportDesignMd` by changing the option to `techContextPath?: string` — either is fine; keep one clear ownership. Prefer CLI read + format so `emitDesignMd` stays a pure string builder.

**Verify**:

```bash
npm run build
OUT=$(mktemp -d)
node bin/cli.js scrub-md --input test/fixtures/DESIGN-source.md --variants 1 --tech-scan test/fixtures/waffle-scan.json --out "$OUT"
node bin/cli.js design-md --input "$OUT" --out "$OUT/design-md-out" --tech-context "$OUT/technology-context.json"
# Expect DESIGN.md to contain Technology Context section with stack language, NOT the absolute path string to technology-context.json
node -e "
const fs=require('fs');const p=process.argv[1];
const md=fs.readFileSync(p+'/DESIGN.md','utf8');
if(md.includes('technology-context.json') && md.match(/\\/Users\\//)) process.exit(2);
if(!/Technology Context/i.test(md)) process.exit(3);
if(!md.includes('## Overview') && !md.trim()) process.exit(4);
console.log('ok');
" "$OUT/design-md-out"
```

→ prints `ok`. Overview should include prose derived from `DESIGN-neutral.md` (non-empty beyond the fallback one-liner when scrub-md was used).

### Step 4: Tests

Extend `test/cli.test.js` modeled after `"scrub-md writes private and builder-facing artifacts without source identity"`:

1. After scrub-md on the fixture, assert builder-facing files do **not** contain `/Users/` (or the resolved fixture directory absolute prefix):
   - `palette-run.json` → `source` matches `/^design-md:/`
   - `build-contract.json` → every `source_reference_ids` entry matches `/^design-md:/` (or `brief-weaver:` if ever present)
   - `scrubbed-design-dna.json` → same for `source_reference_ids`
   - `variants-palette.json` → `source_palette_run` matches `/^design-md:/`
   - `visual-tokens.json` → `source_palette_run` matches `/^design-md:/`
   - `design-md-variation-run.json` → `source_design_md` matches `/^design-md:/`
2. Assert private `raw-reference.json` still retains a recoverable local path under `provenance.local_source_path` (or equivalent key you chose) that equals `resolve(fixture)`.
3. New test: `design-md` after scrub-md writes `DESIGN.md` whose Overview is not only the generic fallback (contains content from scrubbed neutral notes OR structured direction), and with `--tech-context` embeds recommendation text without embedding the tech-context file’s absolute path as the section body.

**Verify**: `npm test` → exit 0; new assertions pass.

## Test plan

- File: `test/cli.test.js`
- Cases: path-opaque builder artifacts; private provenance keeps absolute path; design-md prose load from run root; design-md tech-context content embedding.
- Pattern: existing scrub-md / tmpdir / `execFileAsync("node", [cli, ...])` tests.
- Verification: `npm test` → all pass including new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0 with new path-redaction and design-md tests
- [ ] `rg -n "source: sourcePath" src/scrub.ts` returns no matches
- [ ] `rg -n 'scrubbed", "DESIGN-neutral' src/designmd.ts` either absent or only as fallback after run-root path
- [ ] Builder-facing scrub outputs under a temp run contain no `/Users/` in the files listed in Step 4
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Drift check shows in-scope files no longer match these excerpts.
- Making `source_locator` opaque breaks Brief Weaver import tests or a-eyes sample runner in a way that is not fixed by accepting both `design-md:` and `brief-weaver:` prefixes.
- Downstream a-eyes tooling in this repo clearly requires absolute `run.source` (none known — STOP if you find a hard dependency in `src/` or `test/`).
- A step’s verification fails twice after a reasonable fix attempt.
- Fix appears to require rewriting `run-manifest` path scheme (out of scope).

## Maintenance notes

- Reviewers should confirm absolute paths appear only in private `raw-reference.json` provenance (and never in builder briefs / DNA / contract / palette-run / visual-tokens / variants-palette).
- Plan 003 will change DESIGN-neutral.md body shape; design-md prose loading should keep working as long as the file remains at run root.
- Deferred: relative paths inside `run-manifest.json`; absolute `run_dir` in Pidge payloads.
