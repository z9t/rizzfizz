# Plan 006: Validate run artifacts at command boundaries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/schemas.ts src/preview.ts src/exports.ts src/pidge.ts src/manifest.ts src/technology.ts src/types.ts test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-adversarial-privacy-goldens.md (stable fixtures); prefer after 001 so `source_reference_ids` opaque shape is settled
- **Category**: correctness | tech-debt
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

Only `palette-run.json` is deeply validated (`paletteRunSchema`). `preview`, `export`, `inspect`, and `handoff` load `build-contract.json`, `run-manifest.json`, `technology-context.json`, and related files via unchecked `readJson<T>()` casts. Malformed or partially written runs fail late with property-access errors instead of clear boundary messages. Adding parsers at command entrypoints makes failures obvious and blocks obviously invalid handoff/preview inputs.

## Current state

```ts
// src/schemas.ts — only palette schemas today
export const paletteTokensSchema: Parser<PaletteTokens> = { parse(value) { /* ... */ } };
export const paletteRunSchema: Parser<PaletteRun> = { parse(value) { /* ... */ } };
// helpers: expectRecord, expectString, expectHex, expectEnum, ... (module-private)
```

```ts
// src/io.ts
export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readText(path)) as T;
}
```

```ts
// src/preview.ts — unvalidated reads
const manifest = await readJson<RunManifest>(join(inputDir, "run-manifest.json"));
const contract = await readJson<BuildContract>(manifest.source_safe_entrypoints.build_contract);
const paletteRun = await readJson<PaletteRun>(manifest.source_safe_entrypoints.palette_run);
```

```ts
// src/exports.ts — mixed: palette validated; contract/dna often not
const run = paletteRunSchema.parse(await readJson(join(inputDir, "palette-run.json"))) as PaletteRun;
const contract = await readJson<BuildContract>(join(inputDir, "build-contract.json")); // intake export, no exists() guard
```

```ts
// src/technology.ts — has its own waffleScanSchema + private expect* duplicates
export const waffleScanSchema = { parse(value: unknown): WaffleScan { /* ... */ } };
```

Types to honor live in `src/types.ts` (`BuildContract`, `RunManifest`, `VisualTokensRun`, …) and `TechnologyContext` in `src/technology.ts`.

Exemplar validation style: `paletteRunSchema.parse` — match that `Parser<T>` pattern and error-message tone (`${label} must be …`).

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Negative probe | build + invoke preview/export on truncated JSON | clear thrown Error, non-zero CLI exit |

## Scope

**In scope**:

- `src/schemas.ts` — add parsers (export them)
- Optionally extract shared `expect*` into something both `schemas.ts` and `technology.ts` use — **only if** needed to avoid copy-paste for new parsers; do not force a big technology.ts rewrite
- `src/preview.ts` — validate manifest + palette (+ contract/visual as practical)
- `src/exports.ts` — validate contract when reading; keep `exists` guards consistent (`exportAEyesIntakeVariants` should fail clearly if `build-contract.json` missing)
- `src/manifest.ts` — validate on `inspectRun` reads
- `src/pidge.ts` — already validates palette; optionally validate handoff payload shape when writing (lightweight)
- `test/schemas.test.js` or extensions in `test/cli.test.js` — happy + negative cases
- Use plan 002 fixtures / existing scrub-md outputs as golden valid inputs

**Out of scope**:

- Validating every nested field of design-score / taxonomy reports on day one (start with **required top-level keys** + a few critical nested fields)
- Rewriting Brief Weaver import validation (already has contract checks)
- Changing public artifact schemas’ field names (parse what exists; don’t invent v2)

## Git workflow

- Branch: `advisor/006-boundary-schemas`
- Commit: `feat: validate build-contract and run-manifest at command boundaries`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Add `buildContractSchema` and `runManifestSchema`

In `src/schemas.ts`, following `paletteRunSchema`:

**`buildContractSchema`** (minimum viable, not every nested leaf):

- `schema === "rizzfizz.build-contract.v1"`
- `source_safe === true`
- `source_reference_ids`: non-empty string array
- `intent`: object with string `site_type`, `primary_job`, `audience`, `content_posture`
- `layout`: object with `regions` array (length ≥ 1)
- `variants`: non-empty array; each has `id`, `name`, `palette_tokens` (reuse `paletteTokensSchema`)

**`runManifestSchema`**:

- `schema === "rizzfizz.run-manifest.v1"`
- `source_safe_entrypoints`: object with string paths for `build_contract`, `palette_run`, `variants_json` (others optional/string)
- `private_artifacts.raw_reference`: string
- `variants`: array of `{ id, name, … }`

**`technologyContextSchema`** (can live in `schemas.ts` or stay next to technology module):

- `schema === "rizzfizz.technology-context.v2"`
- `source_safe === true`
- `scan.url === "redacted"` (or string)
- `detected` / `recommendations` present as arrays/object

Export parsers. Keep error messages actionable.

**Verify**: `npm run check` → 0.

### Step 2: Wire parsers at boundaries

Replace unchecked reads:

| Location | Change |
|----------|--------|
| `preview.ts` | `runManifestSchema.parse` then read linked files; `paletteRunSchema.parse` on palette; `buildContractSchema.parse` on contract |
| `exports.ts` `exportAEyesIntakeVariants` | `exists` check for build-contract; then `buildContractSchema.parse` |
| `exports.ts` `exportAgentBriefs` | parse contract when present |
| `manifest.ts` `inspectRun` | parse manifest + contract |
| Optional `pidge.ts` | keep palette parse; no need to validate entire handoff ecosystem this plan |

Do not change write paths in `scrub.ts` except if a type tweak is required.

**Verify**: `npm test` → 0 (existing suite is the regression net).

### Step 3: Negative tests

Add `test/schemas.test.js` (or CLI tests):

1. Valid: scrub-md to temp dir → `buildContractSchema.parse(JSON.parse(read…))` succeeds.
2. Invalid: missing `schema` / empty `variants` → throws matching `/must/`.
3. CLI: write a run dir with valid palette-run but truncated build-contract → `preview` or `export --format a-eyes-intake-variants` exits non-zero with a clear message (not `Cannot read properties of undefined`).

**Verify**: `npm test` → 0.

### Step 4: Align `exportAEyesIntakeVariants` missing-file error

Before parse, if `build-contract.json` missing:

```ts
throw new Error(`export a-eyes-intake-variants requires build-contract.json in ${inputDir}`);
```

**Verify**: CLI reject test covers this.

## Test plan

- `test/schemas.test.js` unit parses
- One CLI negative for preview or intake export
- Goldens: outputs from `test/fixtures/DESIGN-source.md` scrub-md
- Pattern: `paletteRunSchema` usage in `exports.ts` / `test` style from `test/color.test.js`

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `buildContractSchema` and `runManifestSchema` exported from `src/schemas.ts`
- [ ] `preview` and `exportAEyesIntakeVariants` use parsers (grep confirms `.parse(` near those reads)
- [ ] Negative malformed-contract case fails with a schema/validation Error message
- [ ] `plans/README.md` 006 → DONE

## STOP conditions

- Strict nested validation rejects all current scrub-md outputs — loosen to top-level/critical fields only; do not change producers in this plan unless a clear bug.
- Circular import explosion between `schemas.ts` and `technology.ts` — keep technologyContext parser in technology.ts and re-export, or duplicate minimal checks.
- Drift / double failure.

## Maintenance notes

- When adding new required artifact fields, extend the corresponding schema in the same PR.
- Reviewers: prefer clear parse errors over partial HTML/JSON from preview.
- Follow-ups: design-score schema; pidge payload schema; shared expect* module with technology.ts.
