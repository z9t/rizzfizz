# Codebase Concerns

**Analysis Date:** 2026-05-09

## Tech Debt

**Deterministic scrubbing has a narrow identity model:**
- Issue: `scrubSourceText()` removes URLs, emails, a short clone-language list, and identity terms inferred from filenames, URLs, first heading lines, and explicit labels. It does not detect phone numbers, physical addresses, social handles, account IDs, all-caps acronyms, source-specific slogans, or distinctive long-form copy without inferred identity tokens.
- Files: `src/scrub.ts:86`, `src/scrub.ts:111`, `src/scrub.ts:347`, `src/scrub.ts:380`, `test/cli.test.js:27`
- Impact: Builder-facing artifacts can still leak source identity or distinctive phrasing when the input does not match the current heuristics.
- Fix approach: Add adversarial privacy fixtures in `test/cli.test.js` before expanding ingestion. Cover phone/address/social patterns, unlabeled brand names, clone verbs, multiple URLs, non-ASCII emails, and distinctive slogans, then extend `scrubSourceText()` and `extractIdentityTerms()`.

**Generated summaries preserve scrubbed source prose directly:**
- Issue: `buildDesignDna()`, `buildNeutralDesignMd()`, and `buildVariantDesignMd()` all call `summarize(scrubbedText)`, and `summarize()` truncates the scrubbed source text instead of abstracting it into constrained categories.
- Files: `src/scrub.ts:38`, `src/scrub.ts:129`, `src/scrub.ts:273`, `src/scrub.ts:291`, `src/scrub.ts:380`
- Impact: Even after token redaction, distinctive sentence structure or non-redacted copy can appear in `scrubbed-design-dna.json`, `DESIGN-neutral.md`, `DESIGN-variant-*.md`, and `builder-briefs/`.
- Fix approach: Keep deterministic output, but generate summaries from structured buckets such as density, hierarchy, palette relationship, motion, and component style rather than raw source slices. Assert that known distinctive fixture phrases do not appear in builder-facing outputs.

**Integration defaults are local-machine paths:**
- Issue: Whiffler defaults to `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js`, while Pidge tests require `/Users/max/Documents/Code/pidge/pidge`. These are operational tools, not package dependencies.
- Files: `src/cli.ts:26`, `src/cli.ts:49`, `src/technology.ts:68`, `test/cli.test.js:101`, `test/cli.test.js:136`, `package.json:19`
- Impact: Fresh machines and CI environments can run palette/scrub/export paths, but `tech-scan --url`, `scrub-md --tech-url`, and non-dry-run `handoff` can fail unless those local paths exist or users pass explicit paths.
- Fix approach: Add documented environment overrides such as `RIFF_WHIF_BIN` and `PIDGE_BIN`, resolve command names through `PATH` where appropriate, and make local-tool integration tests conditional or fixture-only for normal CI.

**Schema validation is partial outside palette runs:**
- Issue: `paletteRunSchema` deeply validates palette artifacts, but `raw-reference.json`, `scrubbed-design-dna.json`, `technology-context.json`, and Pidge handoff payloads are plain object construction or unchecked `readJson()` results.
- Files: `src/schemas.ts:24`, `src/technology.ts:48`, `src/technology.ts:104`, `src/pidge.ts:102`, `src/exports.ts:38`, `src/scrub.ts:40`
- Impact: Malformed internal artifacts can pass between commands until downstream code fails with less-specific errors.
- Fix approach: Add schemas for raw references, design DNA, technology context, and Pidge handoff payloads in `src/schemas.ts`; validate at command boundaries in `src/scrub.ts`, `src/exports.ts`, and `src/pidge.ts`.

## Known Bugs

**`handoff --pidge pidge` is checked as a file path before execution:**
- Symptoms: `sendPidgeHandoff()` calls `access(pidge)` before `execFile()`. A command available on `PATH` does not necessarily have a readable `./pidge` path in the current directory, so the default can fail before command lookup.
- Files: `src/pidge.ts:38`, `src/pidge.ts:41`, `src/pidge.ts:80`, `src/cli.ts:77`, `test/cli.test.js:101`, `test/cli.test.js:136`
- Trigger: Run `rizzfizz handoff --input <run> --to gemma` with `pidge` installed on `PATH` but no `./pidge` file in the working directory.
- Workaround: Pass an absolute executable path with `--pidge /Users/max/Documents/Code/pidge/pidge`.

**`css-vars` silently normalizes invalid relationship and hue values:**
- Symptoms: `palette` normalizes options explicitly, while `css-vars` passes options directly into `buildPaletteRun()`. `buildPaletteRun()` normalizes internally, so typos silently fall back to `dark-sparse-accent` / `blue`.
- Files: `src/cli.ts:115`, `src/cli.ts:150`, `src/color.ts:59`, `src/color.ts:64`, `src/color.ts:139`
- Trigger: Run `rizzfizz css-vars --relationship typo --hue typo`; CSS is generated with defaults instead of rejecting the invalid values.
- Workaround: Use `rizzfizz palette` first and inspect `relationship` / `hue_family` in `palette-run.json`.

## Security Considerations

**Private source archive is written beside shareable outputs:**
- Risk: `scrub-md` always writes `raw-reference.json` containing `raw_text`, source locator, URLs, colors, font hints, and inferred identity terms. The file is marked private but lives in the same run directory as builder-facing artifacts.
- Files: `src/scrub.ts:58`, `src/scrub.ts:86`, `src/scrub.ts:96`, `src/scrub.ts:97`, `.gitignore:3`
- Current mitigation: `.gitignore` ignores `runs/`, and Pidge attachments exclude `raw-reference.json` unless `--include-raw` is set.
- Recommendations: Keep generated runs under ignored `runs/` or another private root. Add a `--no-raw-reference` or separate private archive root before encouraging workflows that create shareable run directories.

**Technology context embeds raw fingerprint evidence:**
- Risk: `technology-context.json` includes `raw_scan`, which can contain source URLs, response statuses, script paths, evidence values, and technology versions from Whiffler output.
- Files: `src/technology.ts:48`, `src/technology.ts:52`, `src/technology.ts:104`, `src/technology.ts:108`, `src/exports.ts:93`
- Current mitigation: Builder briefs include only `detected` and `recommendations`, not the full `raw_scan`.
- Recommendations: Keep `raw_scan` out of agent-facing payloads by default. Add a source-safe technology export if this data needs to leave the local run directory.

**External commands are argument-safe but trust-boundary sensitive:**
- Risk: Whiffler and Pidge are executed through `execFile()`, avoiding shell interpolation, but user-provided executable paths and URLs still trigger local code execution and outbound network access.
- Files: `src/technology.ts:70`, `src/technology.ts:77`, `src/technology.ts:82`, `src/pidge.ts:80`, `src/cli.ts:25`, `src/cli.ts:77`
- Current mitigation: `execFile()` passes arguments without a shell; Pidge agent names are constrained by `AGENT_NAME_RE`.
- Recommendations: Document that `--tech-url` performs network access, validate protocols to `http:` / `https:`, and do not accept executable paths from untrusted callers if this becomes an API service.

## Performance Bottlenecks

**Whole input files are loaded and duplicated:**
- Problem: `scrub-md` reads the entire source markdown into memory, stores the full value in `raw-reference.json`, and creates several derived artifacts from the same string.
- Files: `src/scrub.ts:26`, `src/scrub.ts:58`, `src/io.ts:4`, `src/io.ts:13`
- Cause: The CLI currently targets small Design Markdown inputs and uses simple `readFile()` / `JSON.stringify()` helpers.
- Improvement path: Add an input size limit before raw archival. If larger inputs become normal, separate private raw archival from builder output generation and avoid duplicating raw text through every workflow.

**Whiffler scan execution has a fixed stdout buffer:**
- Problem: `runWhiffler()` allows up to 10 MB of stdout and parses the result with one `JSON.parse()` call.
- Files: `src/technology.ts:82`, `src/technology.ts:83`, `src/technology.ts:85`
- Cause: The command assumes Whiffler JSON fits comfortably in memory.
- Improvement path: Keep the buffer for local CLI use, but add a clear error for oversized output and fixture coverage for large or malformed Whiffler JSON.

## Fragile Areas

**`src/scrub.ts` concentrates privacy, inference, and artifact generation:**
- Files: `src/scrub.ts:20`, `src/scrub.ts:74`, `src/scrub.ts:86`, `src/scrub.ts:129`, `src/scrub.ts:273`, `src/scrub.ts:347`
- Why fragile: One file owns source archiving, scrubbing, palette run creation, technology context attachment, DNA construction, markdown output, and heuristic inference. Privacy changes can accidentally alter output shape or palette behavior.
- Safe modification: Keep edits within the existing helper boundaries: redaction in `scrubSourceText()` / `extractIdentityTerms()`, artifact shape in `buildDesignDna()` and markdown builders, integration behavior in `maybeBuildTechnologyContext()`.
- Test coverage: Current coverage checks one fixture for URL, `Acme`, and `recreate` removal in `test/cli.test.js:27`; add adversarial fixtures before broadening ingestion.

**Pidge handoff mutates the input run directory:**
- Files: `src/pidge.ts:98`, `src/pidge.ts:101`, `src/pidge.ts:138`, `test/cli.test.js:87`, `test/cli.test.js:120`
- Why fragile: Every handoff writes `<run>/pidge/payload-*.json`; repeated sends accumulate operational files inside the source run directory.
- Safe modification: Store handoff payloads under a clearly ignored operational directory or add cleanup/retention commands before introducing directory-wide scans.
- Test coverage: Dry-run and real-send paths are covered, but repeated sends, retention, and cleanup behavior are not covered.

## Scaling Limits

**Variant generation is capped and not seed-driven:**
- Current capacity: `buildPaletteRun()` clamps variants to 1-12 and uses a fixed 12-item hue offset list.
- Limit: Requests above 12 silently emit 12 variants, and `--seed` validates/parses a color but does not drive palette generation beyond recording `source: seed:<hex>`.
- Scaling path: Preserve the CLI safety cap, but report clamping to users and implement seed-derived hue/chroma behavior before larger batch workflows.
- Files: `src/color.ts:139`, `src/color.ts:148`, `src/cli.ts:111`, `src/cli.ts:112`, `src/cli.ts:114`

**Only Design Markdown ingestion is implemented:**
- Current capacity: Implemented commands are `scrub-md`, `palette`, `export`, `tech-scan`, `handoff`, and `css-vars`.
- Limit: URL, image, screenshot, raw-reference scrub, and API workflows are documented as direction but are not implemented command paths.
- Scaling path: Treat `scrub-md` as the stable ingestion path. Add each new input type behind its own command with privacy fixtures and source-safe output assertions.
- Files: `src/cli.ts:17`, `src/cli.ts:44`, `src/cli.ts:68`, `README.md:21`, `START-HERE.md:20`, `START-HERE.md:60`

## Dependencies at Risk

**Local Whiffler and Pidge are operational dependencies, not npm dependencies:**
- Risk: `package.json` installs only `commander` and `culori` at runtime, while integration commands depend on local Whiffler and Pidge executables.
- Impact: Core palette/scrub/export commands work after `npm install`, but integration commands can fail on clean machines.
- Migration plan: Document setup, support environment overrides, resolve command names through `PATH`, and keep CI tests independent from absolute local tool paths.
- Files: `package.json:19`, `src/technology.ts:68`, `src/pidge.ts:10`, `src/cli.ts:26`, `src/cli.ts:77`

**No production dependency vulnerabilities detected:**
- Risk: Current production dependency risk is low; `npm audit --omit=dev --json` reports zero vulnerabilities.
- Impact: Routine package update review is still required for `commander` and `culori`.
- Migration plan: Keep `package-lock.json` committed and rerun `npm audit --omit=dev` during release checks.
- Files: `package.json:19`, `package-lock.json`

## Missing Critical Features

**No CI configuration is present:**
- Problem: Tests pass locally, but no `.github/workflows/` configuration was detected in the repository scan.
- Blocks: Automated verification for Node 22, TypeScript build, `node --test`, smoke command, and dependency audit on PRs.
- Files: `package.json:14`, `package.json:16`, `package.json:17`

**No service-mode boundary exists:**
- Problem: The code is a trusted local CLI. Command handlers resolve arbitrary filesystem paths, write outputs directly, and can run local executables or network scans through user options.
- Blocks: Exposing RizzFizz as an API or shared service without adding authentication, path sandboxing, upload limits, URL allow/deny policy, output segregation, and executable restrictions.
- Files: `src/cli.ts:17`, `src/cli.ts:44`, `src/cli.ts:68`, `src/io.ts:8`, `src/technology.ts:70`

## Test Coverage Gaps

**Adversarial privacy scrubbing:**
- What's not tested: Phone numbers, physical addresses, social handles, non-labeled brands, source-specific slogans, multiple URLs, non-ASCII emails, and distinctive long-form copy.
- Files: `test/cli.test.js:27`, `src/scrub.ts:111`, `src/scrub.ts:347`, `src/scrub.ts:380`
- Risk: Private identity or copyrighted source expression leaks into builder-facing artifacts despite the source-safe contract.
- Priority: High

**Error paths and invalid inputs:**
- What's not tested: Invalid palette JSON, missing run files, malformed Whiffler JSON, nonexistent Whiffler/Pidge paths, unsupported export formats, bad agent names, and invalid option values.
- Files: `src/cli.ts:53`, `src/cli.ts:139`, `src/pidge.ts:185`, `src/schemas.ts:24`, `src/technology.ts:85`
- Risk: CLI users get unhelpful failures or partial output without tests guarding command behavior.
- Priority: Medium

**Integration behavior depends on local tools:**
- What's not tested: `tech-scan --url` with real Whiffler, timeout behavior, network failure behavior, and Pidge command lookup through `PATH`.
- Files: `test/cli.test.js:67`, `test/cli.test.js:120`, `src/technology.ts:70`, `src/pidge.ts:36`
- Risk: Fixture tests pass while documented integration commands fail in a clean environment.
- Priority: Medium

**Verification status during mapping:**
- `npm test` passes 11 tests.
- `npm audit --omit=dev --json` reports 0 vulnerabilities.
- Files: `package.json:16`, `test/cli.test.js`, `test/color.test.js`

---

*Concerns audit: 2026-05-09*
