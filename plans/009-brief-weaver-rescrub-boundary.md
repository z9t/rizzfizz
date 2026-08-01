# Plan 009: Re-scrub Brief Weaver imports at the trust boundary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/brief-weaver.ts src/scrub.ts test/ scripts/run-briefweaver-import-sample.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (benefits from plans/002 + 008 scrub improvements when available)
- **Category**: security
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

`import-brief-weaver` treats Brief Weaver’s `source_safe: true` schema flag as sufficient. It copies neutral/variant markdown and DNA JSON verbatim and injects `raw_prompt_summary` / `design_direction` into `build-contract.json` intent fields **without** calling `scrubSourceText()`. A leaky or compromised upstream run becomes a RizzFizz “source-safe” surface with no content verification. RizzFizz must enforce its own privacy boundary at import time.

### BSC claim

### [P6] Privacy ownership stays in the scrub layer, not schema trust
- **Smell:** Import path trusts a boolean flag instead of applying the same redaction owned by `scrub.ts`.
- **Move:** Move Function — call shared scrub helpers at the import boundary; schema check remains necessary but not sufficient.
- **Deletes:** “schema flag implies content-safe” special case.
- **LOC note:** up (boundary checks) — correctness clearer.
- **Evidence:** trust-boundary defect.
- **Patch sketch:** After reading BW artifacts, derive identity terms, scrub text fields, scrub-or-reject DNA strings that look like prose, then write RizzFizz outputs.

## Current state

```ts
// src/brief-weaver.ts:60-105 — copy without scrubSourceText
const sourceSafeDna = await readJson<Record<string, unknown>>(join(inputDir, "scrubbed", "scrubbed-design-dna.json"));
const neutralMd = await readText(join(inputDir, "scrubbed", "DESIGN-neutral.md"));
// ...
const scrubbedText = [neutralMd, ...briefWeaverVariants.map((variant) => stringValue(variant.design_direction))].filter(Boolean).join("\n\n");
const buildContract = applyBriefWeaverContractHints(
  buildBuildContract({ scrubbedText, paletteRun, rawReference }),
  briefWeaverVariants,
  variationManifest
);
// ...
await writeText(join(outDir, "DESIGN-neutral.md"), neutralMd);
await Promise.all(paletteRun.variants.map(async (variant) => {
  const content = await readText(join(inputDir, "variants", `DESIGN-${variant.id}.md`));
  await writeText(join(outDir, `DESIGN-${variant.id}.md`), content);
}));

// src/brief-weaver.ts:127-138 — schema flags only
if (payload.source_safe !== true) { throw new Error(...); }

// src/brief-weaver.ts:301-316 — injects upstream prose into contract
primary_job: stringValue(first?.design_direction) || contract.intent.primary_job,
content_posture: promptSummary || contract.intent.content_posture
```

Exemplar for opaque locators already in this file: `source_locator: \`brief-weaver:${runId}\``.  
Scrub API to reuse: `scrubSourceText`, `buildRawReference` from `src/scrub.ts` (exported). Prefer not duplicating regexes inside `brief-weaver.ts`.

Sample path: `npm run sample:briefweaver-import` / `scripts/run-briefweaver-import-sample.mjs`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Sample (if BW fixture available) | `npm run sample:briefweaver-import` | exit 0 |

## Scope

**In scope**:

- `src/brief-weaver.ts` — import pipeline content scrubbing / verification
- `src/scrub.ts` — only if you must export a small helper (e.g. `extractIdentityTerms` already exported by plan 002); do not redesign scrub-md
- `test/` — new test file or cases under `test/cli.test.js` using a **repo-local** synthetic Brief Weaver fixture tree under `test/fixtures/brief-weaver-leaky/` (create). Do not depend on `/Users/max/Documents/Code/brief-weaver/...` for CI.

**Out of scope**:

- Changing Brief Weaver itself
- Plan 003 structured DNA rewrite inside BW DNA (scrub strings; do not redesign DNA schema here)
- Whiffler / Pidge
- Copying BW `raw/` into RizzFizz (already forbidden — keep that)

## Git workflow

- Branch: `advisor/009-brief-weaver-rescrub-boundary`
- Commit style: `fix: re-scrub brief-weaver imports at boundary`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Synthetic leaky BW fixture

Create `test/fixtures/brief-weaver-leaky/` with the minimum files `importBriefWeaverRun` reads:

- `variation-manifest.json`
- `project-brief.json` + `handoff/briefweaver-project-brief.json` (`schemaVersion: briefweaver.project-brief.v1`, `source_safe: true`, `rizzfizz_import.input_schema`)
- `scrubbed/DESIGN-neutral.md` + `scrubbed/scrubbed-design-dna.json` containing planted token `LEAKY_BW_BRAND_7c2e`
- `variants/variants.json` + `variants/DESIGN-variant-1.md` with same token in `design_direction` / body
- `palettes/palette-run.json` — valid enough for `mapPaletteRun` (copy shape from an existing sample under `runs/` or briefweaver sample script expectations)

Read `src/brief-weaver.ts` top-to-bottom for exact required fields while building the fixture. If a field is missing, import will throw — fix the fixture, not production validation.

**Verify**: `npm run build && node -e "import('./dist/brief-weaver.js').then(m=>m.importBriefWeaverRun({input:'test/fixtures/brief-weaver-leaky',out:'/tmp/rf-bw-leaky'}))"` → currently succeeds **and** output still contains `LEAKY_BW_BRAND_7c2e` (documents the bug).

### Step 2: Apply scrub at boundary

In `importBriefWeaverRun`:

1. Build identity terms from imported text (use `buildRawReference` with a synthetic path like `brief-weaver-${runId}.md` plus concatenated plaintext, **or** export/use `extractIdentityTerms` if available).
2. `scrubSourceText` on: neutral MD, each variant MD, `design_direction`, `raw_prompt_summary`, and any string fields copied into contract hints.
3. For DNA JSON: deep-walk string values and scrub, **or** rebuild DNA via existing RizzFizz builders from scrubbed text if simpler and tests stay green. Prefer deep-walk scrub of string leaves if rebuild would drop BW-specific fields.
4. Write only scrubbed content to `outDir`.

Optional hard fail: if after scrub a denylist pattern remains (e.g. `https://`), throw a clear error `Brief Weaver import failed source-safe verification`.

**Verify**: re-run Step 1 command → output artifacts under `/tmp/rf-bw-leaky` do **not** contain `LEAKY_BW_BRAND_7c2e` (unless only inside private `raw-reference` metadata that intentionally records pointers — builder-facing files must be clean).

### Step 3: Automated test

Add `test/brief-weaver-import.test.js` (or CLI test) that imports the leaky fixture to a temp dir and asserts absence of the token in:

- `DESIGN-neutral.md`
- `DESIGN-variant-1.md`
- `build-contract.json`
- `scrubbed-design-dna.json`
- `builder-briefs/` (if written)

**Verify**: `npm test` exits 0.

### Step 4: Smoke sample compatibility

If `npm run sample:briefweaver-import` depends on an external BW run path that is absent in this environment, skip with a note in the PR — do not fail the plan. If the sample path exists, run it and confirm exit 0.

**Verify**: `npm run check` && `npm test`.

## Test plan

- Happy path: existing schema-valid fixture still imports.
- Adversarial: leaky fixture brand token stripped from all builder-facing outputs.
- Pattern: temp dir + `assert` like `test/cli.test.js` Brief Weaver section if present; else new focused file.
- Verification: `npm test`.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0 including new import privacy test
- [ ] `importBriefWeaverRun` calls `scrubSourceText` (or documented equivalent shared helper) — `rg scrubSourceText src/brief-weaver.ts` matches
- [ ] Leaky fixture lives under `test/fixtures/` (not absolute machine paths)
- [ ] No out-of-scope files modified
- [ ] `plans/README.md` row for 009 updated

## STOP conditions

- Required BW contract fields undocumented and fixture cannot be constructed from code alone after 1–2 hours — report missing fields list.
- Scrubbing destroys required BW semantic fields (empty intent) — stop; consider scrubbing only identity-like tokens while preserving structure, or abstracting intent fields like plan 003 buckets.
- Circular import between `brief-weaver.ts` and `scrub.ts` — extract shared `scrubSourceText` to `src/privacy.ts` only if needed; keep change minimal.

## Maintenance notes

- Reviewers: ensure `raw-reference.json` still does not copy BW `raw/` bodies (`raw_text` empty + pointers) — existing contract.
- When plan 008 lands, re-run leaky fixture (fonts/paths) through import.
- Document in README Brief Weaver section one sentence: RizzFizz re-verifies source-safety on import (docs-only follow-up OK).
