# Plan 008: Close scrub coverage gaps (fonts, paths, identity window)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/scrub.ts test/scrub-privacy.test.js test/fixtures/privacy/ test/cli.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-adversarial-privacy-goldens.md (must exist — extend its fixtures/tests)
- **Category**: security | tests
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

Plan 002 adds adversarial goldens and cheap pattern wins (phones/handles). Three concrete bypasses remain in the scrub identity model:

1. **Fonts are extract-only** — `extractFontHints()` fills `possible_fonts` but never feeds `scrubSourceText()`.
2. **Filesystem paths in prose** — scrub redacts `http(s)` and email, not `/Users/...`, `~/...`, or `file://`.
3. **Identity window is first 25 lines** — labeled `Brand:` / headings after line 25 never become scrub terms.

Plan 001 redacts **output artifact** path fields; this plan redacts **input prose** paths and expands identity extraction. Together they close the source-safe boundary.

### BSC claim

### [P1] One identity term list drives scrubbing (no extract-only side channels)
- **Smell:** Fonts are “known” in raw-reference but invisible to redaction.
- **Move:** Preserve Whole Object / Extract Function — build one `identityTerms` set including sanitized font tokens + full-document labeled lines.
- **Deletes:** Extract-only font side channel; magic `slice(0, 25)` special case for labeled identity.
- **LOC note:** up slightly (path regex + font sanitization) while deleting the line-window special case.
- **Evidence:** privacy defect risk.
- **Patch sketch:** After `buildRawReference`, merge sanitized font tokens into terms passed to `scrubSourceText`; scan all lines for labeled brand patterns; add path/`file://` replacements beside URL rules.

## Current state

```ts
// src/scrub.ts:33 — fonts never passed into scrub
const scrubbedText = scrubSourceText(rawText, rawReference.extracted.possible_identity_terms);

// src/scrub.ts:155-170 — no path redaction
export function scrubSourceText(rawText: string, identityTerms: string[]): string {
  let text = rawText
    .replace(/https?:\/\/[^\s)>\]]+/g, "[source URL removed]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/\b(?:recreate|clone|copy exactly|copy this|pixel-perfect copy|duplicate)\b/gi, "draw inspiration from");
  for (const term of identityTerms) { /* ... */ }
  return text /* trim */;
}

// src/scrub.ts:385-394 — fonts collected for raw archive only
function extractFontHints(rawText: string): string[] { /* quoted + after-colon on typography lines */ }

// src/scrub.ts:413-426 — hard 25-line window
for (const line of rawText.split("\n").slice(0, 25)) {
  const heading = line.match(/^#\s+(.+)/);
  const labeled = line.match(/^(?:brand|client|source|site|company|project)\s*:\s*(.+)$/i);
  // ...
}
```

Conventions: prefer unit tests in `test/scrub-privacy.test.js` importing `../dist/scrub.js` (plan 002 pattern). Keep redaction placeholders consistent: `[source URL removed]`, `[email removed]`, `[source identity removed]`; use `[source path removed]` for paths.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Privacy suite | `npm run build && node --test test/scrub-privacy.test.js` | all pass |

## Scope

**In scope**:

- `src/scrub.ts` — `scrubSourceText`, `extractIdentityTerms`, `extractFontHints` wiring, `buildRawReference` / `scrubDesignMarkdown` term merge
- `test/fixtures/privacy/` — add fixtures (or extend existing):
  - `font-only-brand.md` — brand appears only in a typography quoted font line
  - `absolute-paths.md` — contains `/Users/somebody/Code/secret-site/DESIGN.md` and `file:///tmp/ref.md`
  - `brand-below-line-25.md` — ≥25 filler lines then `Brand: NightingaleLabs`
- `test/scrub-privacy.test.js` — asserts for the three cases on scrubbed text and builder-facing JSON after `scrub-md` (or unit-level on `scrubSourceText` + `buildRawReference`)

**Out of scope**:

- Output locator opaque IDs (plan 001)
- `summarize()` / structured DNA (plan 003)
- Taxonomy evidence sentences (plan 007)
- NLP / LLM entity detection
- Windows drive-letter paths beyond a simple conservative pattern (nice-to-have; if added, keep tests)

## Git workflow

- Branch: `advisor/008-scrub-coverage-fonts-paths-identity-window`
- Commits: `test: privacy fixtures for fonts paths identity window` then `fix: scrub fonts paths and full-doc identity labels`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm plan 002 artifacts exist

**Verify**: `test -f test/scrub-privacy.test.js && ls test/fixtures/privacy/` → files present.  
If missing: STOP — execute plan 002 first (or report blocked).

### Step 2: Add three fixtures + failing asserts

Plant unique tokens:

- Font case: `Typography: "Nightingale Display"` (no other Nightingale mentions)
- Path case: absolute unix path + `file://` URI with unique segments
- Window case: `Brand: NightingaleLabs` after 30 blank/heading filler lines

Assert after scrub (unit or CLI): tokens absent from scrubbed text and from `scrubbed-design-dna.json` / `build-contract.json` (not from `raw-reference.json`).

**Verify**: new tests fail on current `b506740` behavior.

### Step 3: Implement redaction + identity expansion

1. Path/`file://` replacements in `scrubSourceText` before identity loop — placeholder `[source path removed]`. Be conservative: match `/Users/`, `/home/`, `~/`, and `file://` URIs. Avoid redacting bare relative paths like `./components`.
2. Merge font-derived terms into the scrub term list. Sanitize: strip generic tokens (`sans`, `serif`, `display`, `font`, `typeface`, lengths &lt; 3). Prefer quoted font family names over full “after colon” blobs when both exist.
3. For labeled `brand|client|...` lines, scan **all** lines (remove `slice(0, 25)` for the labeled matcher). Keep heading scan either full-doc or raised bound — if full-doc headings cause over-scrubbing of design vocabulary, limit headings to first N but **must** keep full-doc labeled lines.

**Verify**: Step 2 tests pass; `npm run check` exits 0.

### Step 4: Regression pass

Run full suite; ensure benign design words (`spacious`, `gallery`) in fixtures still appear where expected.

**Verify**: `npm test` exits 0.

## Test plan

- Unit: `buildRawReference` includes font tokens in terms used for scrubbing (or document merge site explicitly tested).
- Unit: path and `file://` redacted.
- Unit: brand label below line 25 redacted.
- Pattern: `test/scrub-privacy.test.js` / `test/color.test.js` import style.
- Verification: `npm run build && node --test test/scrub-privacy.test.js` → all pass.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] Three new fixtures exist and their banned tokens are absent from builder-facing outputs
- [ ] Labeled identity matching is not limited to `slice(0, 25)` (grep confirms)
- [ ] Font hints contribute to scrub terms (code + test)
- [ ] No out-of-scope files modified
- [ ] `plans/README.md` row for 008 updated

## STOP conditions

- Plan 002 not landed and you cannot add fixtures without conflicting with an in-progress 002 branch — report.
- Font sanitization would require a large dictionary of generic font names — implement quoted-name-only merge first; if still insufficient, report rather than inventing ML.
- Path regex causes mass redaction of version strings or URLs already handled — tighten pattern; do not disable URL redaction.

## Maintenance notes

- Reviewers: watch false-positive redaction of design words that look like brand tokens.
- Future: export `extractIdentityTerms` if not already exported by plan 002 for unit clarity.
- Related: plan 001 (artifact paths) and plan 010 (pidge `run_dir`) — different surfaces.
