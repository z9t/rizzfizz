# Plan 010: Opaque locators in Pidge handoff payloads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/pidge.ts test/cli.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (complements plans/001 path redaction in scrub artifacts; do not wait on 001)
- **Category**: security
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

Even with `--include-raw` off, `writeHandoffPayload` embeds absolute filesystem paths: `run_dir`, and every `source.*` / variant attachment path is `join(inputDir, ...)`. Handoff payloads written under `<run>/pidge/` and sent via Pidge therefore leak operator usernames and directory layout to peer agents. Attachments are already passed as separate files to `pidge send`; the payload should use run-relative paths or opaque ids, not absolute machine paths.

### BSC claim

### [P1] Delete absolute path special case from the handoff contract
- **Smell:** Payload duplicates absolute paths that attachments already carry as files.
- **Move:** Change Representation — `run_dir` → opaque `run_id` / basename; file refs → run-relative paths (`palette-run.json`, `builder-briefs/variant-1.md`).
- **Deletes:** Absolute `inputDir` strings from the shareable payload schema.
- **LOC note:** down slightly.
- **Evidence:** privacy / data minimization.
- **Patch sketch:** Store `run_id: basename(inputDir)` (or manifest id if present); replace `join(inputDir, x)` with relative `x` in JSON; keep `resolve` only for local `access`/`writeJson`/`execFile` args.

## Current state

```ts
// src/pidge.ts:91-141
async function writeHandoffPayload(...) {
  const payload = {
    schema: "rizzfizz.pidge-handoff.v1",
    task: "Use the attached RizzFizz artifacts...",
    run_dir: inputDir,  // absolute
    source: {
      tool: "rizzfizz",
      palette_run: join(inputDir, "palette-run.json"),
      variants_palette: join(inputDir, "variants-palette.json"),
      // ... more join(inputDir, ...)
      raw_reference_included: Boolean(options.includeRaw)
    },
    // ...
    variants: selectedVariants.map((variant) => ({
      // ...
      builder_brief: join(inputDir, "builder-briefs", `${variant.id}.md`),
      design_md: join(inputDir, `DESIGN-${variant.id}.md`),
      // ...
    })),
  };
  await writeJson(payloadPath, payload);
}
```

`collectAttachments` correctly builds absolute paths for the **local** `pidge send --attach` CLI — that may stay absolute (local process only). Do not confuse attachment argv paths with JSON payload fields.

Tests: dry-run handoff coverage around `test/cli.test.js` (search for `handoff` / `dry-run`). Real-pidge test hardcodes `/Users/max/Documents/Code/pidge/pidge` — do not break gating expectations from plan 004; only assert payload JSON content.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |

## Scope

**In scope**:

- `src/pidge.ts` — `writeHandoffPayload` field shapes
- `test/cli.test.js` — assert dry-run payload has no `/Users/` (or process cwd absolute prefix) in JSON body; assert relative paths / `run_id` present

**Out of scope**:

- Changing scrub artifact `source` fields (plan 001)
- Changing `collectAttachments` local absolute paths for execFile
- Pidge CLI itself
- Schema registry / plan 006 full schemas (optional: add a comment that handoff schema will be formalized in 006 — do not implement full Zod here unless trivial)

## Git workflow

- Branch: `advisor/010-pidge-opaque-run-locators`
- Commit: `fix: use relative locators in pidge handoff payloads`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Failing test on dry-run payload

Run handoff `--dry-run` into a temp run dir whose path contains a unique segment (e.g. `leakpath-user`). Read `pidge/payload-*.json` and assert:

- JSON stringified form does not include that absolute directory prefix
- `run_dir` is absent **or** replaced by non-absolute `run_id`
- `source.palette_run` equals `palette-run.json` (relative) or similar

**Verify**: test fails on current code.

### Step 2: Change payload representation

```ts
const runId = basename(inputDir);
const payload = {
  schema: "rizzfizz.pidge-handoff.v1",
  task: "...",
  run_id: runId,
  // omit run_dir
  source: {
    tool: "rizzfizz",
    palette_run: "palette-run.json",
    variants_palette: "variants-palette.json",
    variants_json: await exists(join(inputDir, "variants.json")) ? "variants.json" : null,
    // ... same pattern for other files
  },
  variants: selectedVariants.map((variant) => ({
    // ...
    builder_brief: `builder-briefs/${variant.id}.md`,
    design_md: `DESIGN-${variant.id}.md`,
    // ...
  })),
};
```

Keep writing the payload file to `join(inputDir, "pidge", ...)` using absolute paths locally.

**Verify**: Step 1 test passes; `npm run check` exits 0.

### Step 3: Full suite

**Verify**: `npm test` exits 0. If real-pidge test skips/fails due to missing binary, that is pre-existing (plan 004) — do not expand scope; ensure dry-run tests pass.

## Test plan

- Dry-run payload: no absolute path leak; relative artifact keys present.
- Pattern: existing handoff dry-run test in `test/cli.test.js`.
- Verification: `npm test`.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0 for dry-run handoff assertions
- [ ] `rg -n "run_dir:" src/pidge.ts` returns no matches
- [ ] Payload JSON uses relative artifact paths
- [ ] `collectAttachments` still supplies real local paths to pidge CLI
- [ ] No out-of-scope files modified
- [ ] `plans/README.md` row for 010 updated

## STOP conditions

- Downstream agents documented as requiring absolute `run_dir` to open files — report; consider keeping absolute paths only under a `local_debug` flag defaulting off.
- Plan 006 already merged a handoff schema that mandates `run_dir` — update schema in the same PR or STOP and reconcile.

## Maintenance notes

- Reviewers: confirm attachment argv paths remain absolute/local-only.
- Align docs in README Pidge section: payload paths are run-relative.
- After plan 001, scrub artifacts and handoff payloads should both avoid absolute source paths.
