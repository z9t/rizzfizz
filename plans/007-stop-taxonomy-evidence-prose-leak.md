# Plan 007: Stop taxonomy `source_safe_evidence` prose leak

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/design-system-taxonomy.ts src/types.ts src/preview.ts src/contract.ts test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-adversarial-privacy-goldens.md (preferred — reuse privacy fixtures); complementary to plans/003 (003 does **not** fix this path)
- **Category**: security | tech-debt
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

Plan 003 removes prose truncation via `summarize()` in DNA/DESIGN markdown. A **separate** leak remains: `classifyDesignSystem()` copies up to three source sentences into `source_safe_evidence`, which lands in `build-contract.json` → preview HTML → builder briefs. `sourceSafeSnippet()` only strips URLs, emails, and four hard-coded calibration brands — not identity terms or distinctive slogans. Distinctive reference phrasing can fingerprint the source even when token scrubbing succeeds.

### BSC claim (must hold after the change)

### [P1] Delete sentence-copy as the evidence representation
- **Smell:** “Source-safe evidence” is still sliced source prose with a thin redaction pass.
- **Move:** Replace Conditional / Change Representation — evidence becomes abstract labels (matched terms + quality categories), not sentences.
- **Deletes:** `evidenceSnippets` sentence-splitting concept; reliance on `sourceSafeSnippet` for privacy.
- **LOC note:** rewrite — fewer leaky strings, possibly slightly more structured fields.
- **Evidence:** defect risk on privacy boundary (product-critical).
- **Patch sketch:** `source_safe_evidence: string[]` becomes category/term labels only, e.g. `["matched:spacious", "quality:hierarchy"]`, or a small structured array `{ kind, label }[]` if types allow without breaking a-eyes (prefer keep `string[]` of abstract labels for minimal blast radius).

## Current state

- `src/design-system-taxonomy.ts` — classifier; builds `source_safe_evidence` via `evidenceSnippets`.
- `src/types.ts` — `DesignSystemClassification.source_safe_evidence: string[]`.
- `src/contract.ts` — embeds `design_system_classification` into `build-contract.json`.
- `src/preview.ts:345` — renders evidence list into HTML.
- `src/scrub.ts:43-49` — feeds scrubbed text into `classifyDesignSystem` then `buildBuildContract`.

```ts
// src/design-system-taxonomy.ts (~565)
source_safe_evidence: evidenceSnippets(text, primary.matched_terms)

// src/design-system-taxonomy.ts:655-673
function evidenceSnippets(text: string, matchedTerms: string[]): string[] {
  const terms = matchedTerms.filter((term) => term.length > 2);
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sourceSafeSnippet(sentence.trim()))
    .filter(Boolean);
  const matched = sentences.filter((sentence) =>
    terms.some((term) => normalizeText(sentence).includes(normalizeText(term)))
  );
  return unique((matched.length ? matched : sentences).slice(0, 3)).map((sentence) => (
    sentence.length > 180 ? `${sentence.slice(0, 177).trim()}...` : sentence
  ));
}

function sourceSafeSnippet(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)>\]]+/g, "[source URL removed]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/\b(?:Linear|Apple|Stripe|Notion)\b/g, "[calibration reference removed]");
}
```

Conventions: keep `schema` / `source_safe: true` patterns; unit tests import from `../dist/*.js` after `npm run build` (see `test/design-system-taxonomy.test.js`). Match existing taxonomy test style.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Taxonomy only | `npm run build && node --test test/design-system-taxonomy.test.js` | all pass |
| Privacy (if 002 landed) | `npm run build && node --test test/scrub-privacy.test.js` | all pass |

## Scope

**In scope**:

- `src/design-system-taxonomy.ts` — replace `evidenceSnippets` / `sourceSafeSnippet` usage with abstract evidence builder
- `src/types.ts` — only if you must widen the type (prefer keep `string[]` of abstract labels)
- `test/design-system-taxonomy.test.js` — assert evidence contains no fixture slogan / distinctive phrase
- `test/scrub-privacy.test.js` or `test/cli.test.js` — one end-to-end assert that `build-contract.json` → `design_system_classification.source_safe_evidence` has no banned distinctive phrase from a privacy fixture (if plan 002 fixtures exist; otherwise add a minimal fixture under `test/fixtures/privacy/`)

**Out of scope**:

- Replacing `summarize()` (plan 003)
- Path redaction in palette/source fields (plan 001)
- Brief Weaver import scrubbing (plan 009)
- Renaming or splitting the entire taxonomy file (DEBT-03 — deferred)
- Changing a-eyes `variants.json` top-level shape beyond whatever already embeds classification evidence

## Git workflow

- Branch: `advisor/007-stop-taxonomy-evidence-prose-leak`
- Commit style (from `git log`): short imperative, e.g. `fix: abstract design-system evidence labels`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Characterization — prove the leak

Add a failing (or temporarily documenting) test that classifies text containing a unique slogan like `ZEPHYR_CALM_CINEMATIC_SLOGAN_9f3a` and asserts that string does **not** appear in `classification.source_safe_evidence`. Expect current code to fail this assert.

**Verify**: `npm run build && node --test test/design-system-taxonomy.test.js` → new test fails for the right reason (slogan present in evidence).

### Step 2: Replace evidence representation

Implement something equivalent to:

```ts
function abstractEvidence(matchedTerms: string[], qualityCats: string[]): string[] {
  const termLabels = matchedTerms.filter((t) => t.length > 2).slice(0, 8).map((t) => `term:${t}`);
  const qualityLabels = qualityCats.slice(0, 5).map((c) => `quality:${c}`);
  return unique([...termLabels, ...qualityLabels]).slice(0, 12);
}
```

Wire it where `evidenceSnippets` is called. Remove or stop calling `evidenceSnippets` / `sourceSafeSnippet` for classification output (delete dead helpers if unused).

Do **not** put raw sentences into evidence. Matched terms must already be taxonomy vocabulary (keywords), not free-form user nouns — if `matched_terms` can contain arbitrary substrings from user text, whitelist against known taxonomy term lists only.

**Verify**: characterization test from Step 1 passes; `npm run check` exits 0.

### Step 3: Preview / contract consumers

Confirm `src/preview.ts` still renders the string list usefully (labels are fine as `<li>` text). Update any snapshot-like asserts in tests that expected full sentences.

**Verify**: `npm test` exits 0.

### Step 4: End-to-end privacy assert

If `test/fixtures/privacy/slogan-and-clone.md` exists (plan 002), scrub it and assert the slogan is absent from `build-contract.json` under `design_system_classification.source_safe_evidence`. If the fixture does not exist yet, STOP and report — either land plan 002 first or add a minimal fixture in this plan’s test file only.

**Verify**: targeted test passes; `npm test` exits 0.

## Test plan

- Unit: taxonomy classification evidence never contains a planted distinctive slogan; evidence items match `/^(term|quality):/` (or the chosen label prefix).
- Integration: scrub → `build-contract.json` evidence has no banned phrase.
- Pattern: `test/design-system-taxonomy.test.js`.
- Verification: `npm test` → all pass including new cases.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `rg -n "evidenceSnippets|sourceSafeSnippet" src/` returns no matches (or only a comment pointing to this plan if a tiny helper remains for non-classification use — prefer zero)
- [ ] New/updated tests assert absence of distinctive prose in `source_safe_evidence`
- [ ] No files outside Scope modified (`git status`)
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

- Plan 003 already changed `source_safe_evidence` shape incompatibly — reconcile before continuing.
- a-eyes or Brief Weaver contract docs require sentence-form evidence — report; do not silently break external contracts; prefer dual-field only if documented.
- Characterization shows slogans do **not** currently leak via this path (unexpected) — re-verify with longer sentences matching taxonomy terms; if still clean, report and downgrade rather than drive-by refactoring.
- Fix appears to require editing `src/exports.ts` brief templates beyond reading classification — stop and report.

## Maintenance notes

- Reviewers: ensure evidence cannot reintroduce free-text by “helpful” formatting later.
- Follow-up: once plan 003 lands, privacy goldens should cover DNA **and** classification evidence in one suite.
- Deferred: splitting `design-system-taxonomy.ts` (profiles vs classifier).
