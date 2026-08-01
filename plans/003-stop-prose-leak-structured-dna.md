# Plan 003: Stop prose leak with structured source-safe DNA

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/scrub.ts test/scrub-privacy.test.js test/cli.test.js test/fixtures/privacy/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-adversarial-privacy-goldens.md
- **Category**: security | direction
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

Even after token redaction, RizzFizz still feeds builder-facing outputs truncated **source prose** via `summarize(scrubbedText)` and appends the **entire** `scrubbedText` under “Source-Safe Notes” in `DESIGN-neutral.md`. Distinctive phrasing fingerprints the reference site and undermines the source-safe contract. This plan deletes that leak concept: builder summaries and DESIGN markdown must come from structured abstract buckets (density, mood, palette relationship, motion, avoid_copying) — not source slices. Characterization tests from plan 002 (slogan / distinctive phrase gaps) become hard asserts here.

## Current state

```ts
// src/scrub.ts — DNA summary is truncated scrubbed prose
function buildDesignDna(...) {
  const summary = summarize(scrubbedText);
  return {
    schema: "rizzfizz.design-dna.v1",
    builder_summary: summary,
    // ...
  };
}

// src/scrub.ts — neutral MD embeds full scrubbed body
function buildNeutralDesignMd(scrubbedText: string, paletteRun: PaletteRun): string {
  return `# Source-Safe Design Direction

${summarize(scrubbedText)}
// ...
## Source-Safe Notes

${scrubbedText}
`;
}

// src/scrub.ts — variant MD also summarizes scrubbed prose
function buildVariantDesignMd(scrubbedText: string, variant: ...) {
  return `# ${variant.name}
## Builder Direction
${summarize(scrubbedText)}
// ...
`;
}

// src/scrub.ts — summarize truncates; does not abstract
function summarize(text: string): string {
  const plain = text.replace(/^#+\s+/gm, "").replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return "Premium source-safe website direction...";
  return plain.length > 520 ? `${plain.slice(0, 517).trim()}...` : plain;
}
```

Helpers already present in the same file for structured inference: `inferDensity`, `inferWhitespace`, `inferMood`, plus `inferRelationship` / `inferHue` (on raw text). `buildBuildContract` in `src/contract.ts` already produces structured intent/layout/motion — DNA/markdown should align with that vocabulary, not duplicate raw prose.

Plan 002 must have landed `test/fixtures/privacy/` and `test/scrub-privacy.test.js` with skipped gap cases for slogans/distinctive phrases.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Privacy suite | `npm run build && node --test test/scrub-privacy.test.js test/cli.test.js` | pass |

## Scope

**In scope**:

- `src/scrub.ts` — `summarize`, `buildDesignDna`, `buildNeutralDesignMd`, `buildVariantDesignMd` (and small helpers)
- `test/scrub-privacy.test.js` — unskip/strengthen distinctive-prose asserts
- `test/cli.test.js` — only if existing scrub assertions need adjustment for new DNA/markdown shape
- Optional: tiny shared builder for “abstract direction paragraphs” if it keeps scrub.ts readable

**Out of scope**:

- LLM-based rewriting
- Screenshot ingestion
- Full redesign of `build-contract.json` schema
- Splitting scrub.ts into multiple modules (tech-debt; not required here)
- Path redaction / Whiffler / CI (other plans)

## Git workflow

- Branch: `advisor/003-stop-prose-leak-structured-dna`
- Commit message example: `fix: emit structured source-safe DNA instead of source prose`
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Confirm plan 002 goldens exist

**Verify**:

```bash
test -f test/scrub-privacy.test.js && ls test/fixtures/privacy/ | head
```

→ privacy test file and fixtures present. If missing, STOP and report that plan 002 must run first.

### Step 2: Replace `summarize()` with structured abstract summary

Implement something with this shape (names may vary; keep one clear job):

```ts
function buildAbstractBuilderSummary(input: {
  scrubbedText: string;
  paletteRun: PaletteRun;
}): string {
  // Use inferMood / inferDensity / inferWhitespace + palette relationship fields
  // Return 1–3 sentences of abstract guidance with NO verbatim clauses from scrubbedText
}
```

Rules:

- Do **not** slice/truncate `scrubbedText` into the summary.
- Keyword presence checks (`includes("spacious")`) are OK for selecting abstract adjectives; copying surrounding sentences is not.
- Prefer composing from a fixed phrase table keyed by inferred traits.

Wire `buildDesignDna` to set `builder_summary` from this helper. Optionally add structured fields alongside (e.g. `traits: { density, whitespace, mood[] }`) without removing `builder_summary` (downstream briefs may read the string).

**Verify**: `npm run check` → exit 0.

### Step 3: Stop embedding full scrubbed body in DESIGN markdown

`buildNeutralDesignMd`:

- Remove the `## Source-Safe Notes\n\n${scrubbedText}` section entirely, **or** replace it with a short bullet list of abstract traits (density, mood, palette relationship, motion posture).
- Lead paragraph uses `buildAbstractBuilderSummary`, not `summarize(scrubbedText)`.

`buildVariantDesignMd`:

- Builder Direction uses abstract summary + variant palette usage notes already present — not source prose.

Delete `summarize` if unused; if still used elsewhere in the file, rename to make the anti-pattern obvious and remove call sites from builder-facing paths.

**Verify**:

```bash
npm run build
OUT=$(mktemp -d)
node bin/cli.js scrub-md --input test/fixtures/DESIGN-source.md --variants 1 --out "$OUT"
# Distinctive fixture phrase must not appear in builder-facing files
node -e "
const fs=require('fs');const path=require('path');
const out=process.argv[1];
const phrase='calm, cinematic, spacious, and premium';
const files=['scrubbed-design-dna.json','DESIGN-neutral.md','DESIGN-variant-1.md','builder-briefs/variant-1.md','build-contract.json'];
for (const f of files) {
  const t=fs.readFileSync(path.join(out,f),'utf8');
  if (t.includes(phrase)) { console.error('leak in', f); process.exit(2); }
}
console.log('no distinctive phrase leak');
" "$OUT"
```

→ prints `no distinctive phrase leak`.

Note: private `raw-reference.json` **may** still contain the phrase; do not assert against it.

### Step 4: Flip plan 002 gap tests to hard asserts

In `test/scrub-privacy.test.js`:

- Unskip slogan / distinctive-prose cases.
- Assert forbidden slogans and distinctive sentences do **not** appear in scrubbed builder outputs (CLI scrub-md on those fixtures, check DNA + DESIGN-neutral + briefs).
- Keep asserts specific (exact slogan strings from fixtures), not vague.

Adjust CLI scrub test in `test/cli.test.js` if it assumed DESIGN-neutral contains long scrubbed notes.

**Verify**: `npm test` → exit 0.

## Test plan

- Strengthen `test/scrub-privacy.test.js` gap cases into regressions.
- Add/adjust CLI assert that `DESIGN-neutral.md` has no `## Source-Safe Notes` full-body dump (or that section lacks verbatim fixture sentences).
- Pattern: plan 002 tests + existing scrub-md CLI test.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `rg -n "Source-Safe Notes" src/scrub.ts` returns no matches (or section no longer interpolates `scrubbedText`)
- [ ] `rg -n "summarize\(" src/scrub.ts` returns no matches **or** `summarize` is gone
- [ ] Distinctive phrase probe in Step 3 passes
- [ ] No files outside scope modified
- [ ] `plans/README.md` 003 → DONE

## STOP conditions

- Plan 002 artifacts missing.
- Downstream Brief Weaver import or a-eyes sample requires verbatim scrubbed notes in DESIGN-neutral (none known; STOP if found in `src/brief-weaver.ts` or sample runner).
- Abstract summary becomes empty/useless for all fixtures — tighten phrase tables rather than reverting to truncation; if stuck after two attempts, STOP.
- Drift / double verification failure.

## Maintenance notes

- Reviewers: ensure no path reintroduces `scrubbedText` into builder-facing strings.
- Future LLM summarization must still assert adversarial fixtures never appear verbatim.
- `design-md` (plan 001) reads DESIGN-neutral.md — keep enough abstract prose that Overview is non-empty.
