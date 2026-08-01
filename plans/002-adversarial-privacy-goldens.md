# Plan 002: Add adversarial privacy goldens for scrubbing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b506740..HEAD -- src/scrub.ts test/cli.test.js test/fixtures/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (can run parallel with 001; must land before plan 003)
- **Category**: tests | security
- **Planned at**: commit `b506740`, 2026-07-31

## Why this matters

Source-safe scrubbing is the core trust boundary of RizzFizz. Today coverage is essentially one happy-path fixture (`DESIGN-source.md` with Acme URL/brand/recreate). Phones, social handles, addresses, unlabeled brands, slogans, and distinctive long-form copy can survive into builder-facing artifacts with no failing test. This plan adds characterization goldens **before** expanding scrub heuristics or replacing `summarize()` (plan 003). Some new tests are expected to fail until scrub improves — for this plan, mark those cases as documenting current gaps with `assert.fail` replaced by an allowlist strategy: either (A) implement the minimum redaction needed so goldens pass, or (B) keep failing cases in a clearly named `test/privacy-gaps.test.js` that uses `test.skip` / TODO with a comment pointing to plan 003 — **prefer (A) for cheap pattern wins (phone/email-like/handles) and (B) only for distinctive-prose cases owned by plan 003**.

## Current state

- `src/scrub.ts` — `scrubSourceText` redacts URLs, emails, a short clone-verb list, and `\b`-bounded identity terms from `extractIdentityTerms` (filename stem, URL host tokens, first headings, labeled brand/client lines). Exported: `scrubSourceText`, `buildRawReference`, `scrubDesignMarkdown`. `extractIdentityTerms` is **not** exported.
- `test/fixtures/DESIGN-source.md` — short Acme gallery fixture.
- `test/cli.test.js` — `"scrub-md writes private and builder-facing artifacts without source identity"` asserts absence of URL/`Acme`/`recreate` in contract/briefs.

```ts
// src/scrub.ts — scrubSourceText (current)
export function scrubSourceText(rawText: string, identityTerms: string[]): string {
  let text = rawText
    .replace(/https?:\/\/[^\s)>\]]+/g, "[source URL removed]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/\b(?:recreate|clone|copy exactly|copy this|pixel-perfect copy|duplicate)\b/gi, "draw inspiration from");
  for (const term of identityTerms) {
    if (term.length < 3) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[source identity removed]");
  }
  // ...
}
```

Conventions: unit tests may import compiled modules from `../dist/*.js` after build (see `test/color.test.js`). CLI tests use temp dirs + `execFileAsync`. Prefer adding a focused unit test file for scrub helpers rather than growing `cli.test.js` without bound.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Typecheck | `npm run check` | exit 0 |
| Tests     | `npm test` | exit 0 |
| Scrub unit only | `npm run build && node --test test/scrub-privacy.test.js` | all pass |

## Scope

**In scope**:

- `test/fixtures/privacy/` — new adversarial markdown fixtures (create directory + files)
- `test/scrub-privacy.test.js` — new unit/CLI privacy tests (create)
- `src/scrub.ts` — only the **minimum** redaction expansions needed so phone/handle/email-adjacent cases pass (keep changes small and listed in the PR/commit message)
- Optionally export `extractIdentityTerms` for direct unit testing (or test via `buildRawReference(...).extracted.possible_identity_terms`)

**Out of scope**:

- Replacing `summarize()` / removing full `scrubbedText` embed in neutral MD (plan 003)
- Path redaction (plan 001)
- Schema work (plan 006)
- Broad NLP / LLM scrubbing
- Changing builder brief templates unrelated to privacy asserts

## Git workflow

- Branch: `advisor/002-adversarial-privacy-goldens`
- Commits: `test: adversarial privacy fixtures for scrub` then `fix: scrub phones and social handles` (if implementing minimum redactions)
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add adversarial fixtures

Create at least these files under `test/fixtures/privacy/`:

1. `phones-and-handles.md` — contains an AU/US-style phone number, an `@handle`, and an email (email already scrubbed today; keep as regression).
2. `unlabeled-brand.md` — brand name appears in prose without `Brand:` label and without being in the filename (e.g. file named `DESIGN-neutral-ref.md` but body mentions `ZephyrOptics` repeatedly).
3. `slogan-and-clone.md` — distinctive slogan sentence + clone verbs beyond the current list if useful (`pixel-perfect copy` already covered; add `mirror this site`).
4. `multi-url.md` — multiple `https://` URLs and one `mailto:`.

Each fixture should also include benign design vocabulary (`spacious`, `gallery`, `accent`) so over-scrubbing is detectable.

**Verify**: `ls test/fixtures/privacy/` → lists the four files.

### Step 2: Unit tests against scrub helpers

Create `test/scrub-privacy.test.js` modeled after `test/color.test.js` (import from `../dist/scrub.js` after build):

For each fixture:

```js
const raw = await readFile(fixturePath, "utf8");
const ref = buildRawReference(fixturePath, raw);
const scrubbed = scrubSourceText(raw, ref.extracted.possible_identity_terms);
```

Assert for **must-pass-now** cases (implement redaction if needed):

- No raw `https://` URLs remain in `scrubbed`
- No email addresses remain
- Phone patterns do not remain in full (define a simple regex the test uses, e.g. `\+?\d[\d\s().-]{7,}\d`)
- `@handle` forms do not remain

Assert for **gap-documented** cases (plan 003 territory) using `test` with a clear name prefix `gap:` and **either**:

- `test.skip('gap: distinctive slogan…', …)` with a one-line reason, **or**
- assert the slogan **is still present** today with a comment `// characterization: expected fail until plan 003` — prefer `test.skip` so `npm test` stays green.

Also add one CLI-level test: scrub-md on `phones-and-handles.md` and assert builder-facing bundle (`build-contract.json` + `builder-briefs/*.md` + `scrubbed-design-dna.json` stringified) contains none of the forbidden phone/handle/email/url substrings.

**Verify**: `npm run build && node --test test/scrub-privacy.test.js` → pass (skipped gaps OK).

### Step 3: Minimum scrub expansions (only if Step 2 requires them)

In `src/scrub.ts` `scrubSourceText`, add conservative redactions:

- Phone-like digit runs → `[phone removed]`
- `@word` social handles → `[handle removed]` (avoid eating CSS `@media` — require handle pattern like `@[A-Za-z][A-Za-z0-9_]{2,}` and/or strip only outside code fences)
- Optional: `mailto:` URLs

Do **not** attempt slogan paraphrasing here.

**Verify**: `npm test` → exit 0.

### Step 4: Wire into npm test

`npm test` already runs `node --test` with no path filter, so new `test/*.test.js` files are picked up automatically. Confirm `package.json` `"test"` script is still `npm run build && node --test`.

**Verify**: `npm test` → exit 0; output lists `scrub-privacy` tests.

## Test plan

- New file `test/scrub-privacy.test.js` with parameterized cases over fixtures.
- CLI scrub-md assert on phones/handles fixture.
- Skipped/gap tests document slogan/unlabeled-brand until plan 003.
- Pattern: `test/color.test.js` for dist imports; `test/cli.test.js` for CLI.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `npm test` exits 0
- [ ] `test/fixtures/privacy/` contains ≥4 fixtures
- [ ] `test/scrub-privacy.test.js` exists and runs under `npm test`
- [ ] Phone/handle/URL/email must-pass asserts are green (with scrub changes if needed)
- [ ] Distinctive-prose/slogan cases are explicitly skipped or deferred with comments pointing to plan 003 — not silently ignored
- [ ] No unrelated refactors
- [ ] `plans/README.md` status row for 002 → DONE

## STOP conditions

- Drift in `scrubSourceText` signature or removal of exports.
- Redacting `@media` / CSS breaks design-score or taxonomy tests — narrow the handle regex; if still stuck, STOP.
- Unlabeled-brand redaction seems to require an LLM — do not invent; leave as skipped gap for plan 003.
- Verification fails twice.

## Maintenance notes

- Plan 003 must flip skipped slogan/prose gap tests to failing assertions then fix them via structured DNA.
- Reviewers: reject over-broad redaction that strips normal design words (`minimal`, `blue`, etc.).
- Keep fixtures small; they are the privacy corpus for future work.
