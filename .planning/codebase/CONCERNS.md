# Codebase Concerns

**Analysis Date:** 2026-05-09

## Tech Debt

**Deterministic scrubbing has a narrow identity model:**
- Issue: `scrubSourceText()` removes URLs, emails, a small clone-language list, and identity terms inferred from the filename, source URLs, first heading lines, and explicit labels. It does not detect phone numbers, addresses, social handles, account IDs, copyrighted phrases beyond a short literal list, all-caps acronyms, or distinctive long-form copy that lacks an inferred identity token.
- Files: `src/scrub.ts:86`, `src/scrub.ts:111`, `src/scrub.ts:347`, `src/scrub.ts:380`, `README.md:129`
- Impact: Builder-facing artifacts can still leak source identity or distinctive phrasing when the source does not match the current heuristics.
- Fix approach: Add a dedicated redaction test matrix in `test/cli.test.js` for emails, URLs, brand labels, phone/address/social patterns, clone verbs, and distinctive copy. Extend `scrubSourceText()` and `extractIdentityTerms()` in `src/scrub.ts` with explicit detectors before expanding output formats.

**Generated summaries can preserve unsanitized source phrasing:**
- Issue: `buildDesignDna()`, `buildNeutralDesignMd()`, and `buildVariantDesignMd()` call `summarize(scrubbedText)`, which truncates the scrubbed source text directly instead of producing an abstraction.
- Files: `src/scrub.ts:38`, `src/scrub.ts:129`, `src/scrub.ts:273`, `src/scrub.ts:291`, `src/scrub.ts:380`
- Impact: Even after token redaction, distinctive source sentence structure can be copied into `scrubbed-design-dna.json`, `DESIGN-neutral.md`, and `builder-briefs/`.
- Fix approach: Keep deterministic mode, but summarize into constrained categories and phrases rather than raw slices. Add fixture assertions in `test/cli.test.js` that known distinctive copy does not appear in any builder-facing output.

**Runtime integration paths are local-machine defaults:**
- Issue: Whiffler defaults to `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js`, while tests use `/Users/max/Documents/Code/pidge/pidge`. The README describes these as local integrations rather than installable dependencies.
- Files: `src/cli.ts:26`, `src/cli.ts:49`, `src/technology.ts:68`, `test/cli.test.js:101`, `test/cli.test.js:136`, `README.md:85`, `HANDOFF.md:39`
- Impact: Fresh machines and CI environments fail unless the same local paths exist or users pass explicit `--whiffler` / `--pidge` paths.
- Fix approach: Move defaults behind environment variables such as `RIFF_WHIF_FLIER` or documented config, make integration tests skip when local executables are unavailable, and keep a fixture-only path for normal CI.

**Schema validation is partial outside palette runs:**
- Issue: `paletteRunSchema` deeply validates palette output, but `raw-reference.json`, `scrubbed-design-dna.json`, `technology-context.json`, and Pidge handoff payloads are plain object construction or untyped `readJson()` results.
- Files: `src/schemas.ts:24`, `src/exports.ts:38`, `src/technology.ts:35`, `src/pidge.ts:102`, `src/scrub.ts:40`
- Impact: Malformed internal artifacts can pass between commands until a downstream command fails with a less specific error.
- Fix approach: Add schemas for raw references, design DNA, technology context, and Pidge handoff payloads in `src/schemas.ts`; validate at command boundaries in `src/exports.ts`, `src/pidge.ts`, and `src/scrub.ts`.

## Known Bugs

**`handoff --pidge pidge` is checked as a file path before execution:**
- Symptoms: `sendPidgeHandoff()` calls `access(pidge)` even when `pidge` is the command name `pidge`. A command available on `PATH` does not necessarily correspond to a readable file in the current directory, so the documented default can fail before `execFile()` searches `PATH`.
- Files: `src/pidge.ts:38`, `src/pidge.ts:41`, `src/pidge.ts:80`, `src/cli.ts:77`, `README.md:99`, `HANDOFF.md:41`
- Trigger: Run `rizzfizz handoff --input <run> --to gemma` with `pidge` installed on `PATH` but no `./pidge` file in the working directory.
- Workaround: Pass an absolute executable path with `--pidge /Users/max/Documents/Code/pidge/pidge`.

**`css-vars` convenience command accepts invalid relationship and hue silently:**
- Symptoms: `palette` normalizes `--relationship` and `--hue`, while `css-vars` passes options directly into `buildPaletteRun()`. `buildPaletteRun()` normalizes internally, so typos silently fall back to defaults rather than surfacing invalid user input.
- Files: `src/cli.ts:115`, `src/cli.ts:150`, `src/color.ts:59`, `src/color.ts:64`, `src/color.ts:146`
- Trigger: Run `rizzfizz css-vars --relationship typo --hue typo`; output is generated with default relationship/hue.
- Workaround: Use `rizzfizz palette` first and inspect `relationship` / `hue_family` in `palette-run.json`.

## Security Considerations

**Private source archive is written by default:**
- Risk: `scrub-md` always writes `raw-reference.json` containing `raw_text`, source URLs, source locator, font hints, colors, and identity terms. The file is deliberately private but lives beside builder-facing outputs in the same run directory.
- Files: `src/scrub.ts:58`, `src/scrub.ts:86`, `src/scrub.ts:96`, `src/scrub.ts:97`, `README.md:36`, `README.md:127`
- Current mitigation: Pidge attachments exclude `raw-reference.json` unless `--include-raw` is set, and the Pidge payload records `raw_reference_included`.
- Recommendations: Make run directories private by default in docs, add a `.gitignore` pattern for generated run directories if the project standardizes one, and consider `--no-raw-reference` or separate private output roots for workflows that produce shareable artifacts.

**Technology context embeds raw fingerprint evidence:**
- Risk: `technology-context.json` includes `raw_scan`, which can contain source URLs, response statuses, script paths, evidence values, and technology versions.
- Files: `src/technology.ts:48`, `src/technology.ts:52`, `src/technology.ts:104`, `src/technology.ts:108`, `src/exports.ts:93`
- Current mitigation: Builder briefs include only `detected` and `recommendations`, not the full `raw_scan`.
- Recommendations: Keep `raw_scan` out of agent-facing brief payloads by default, and add a source-safe export mode if technology context needs to be shared outside the local run directory.

**External command execution is argument-safe but trust-boundary-sensitive:**
- Risk: Whiffler and Pidge are executed through `execFile()`, which avoids shell interpolation, but user-provided executable paths and URLs still trigger local tool execution and outbound network activity.
- Files: `src/technology.ts:70`, `src/technology.ts:82`, `src/pidge.ts:80`, `src/cli.ts:25`, `src/cli.ts:77`
- Current mitigation: `execFile()` passes arguments without a shell; agent names are constrained by `AGENT_NAME_RE`.
- Recommendations: Document that `--tech-url` performs network access, validate URL protocols to `http:` / `https:`, and avoid accepting executable paths from untrusted callers if this becomes an API service.

## Performance Bottlenecks

**Whole input files are loaded into memory and duplicated into JSON:**
- Problem: `scrub-md` reads the entire source markdown as a string, keeps the whole value in `raw-reference.json`, then writes several derived files in parallel.
- Files: `src/scrub.ts:26`, `src/scrub.ts:58`, `src/io.ts:4`, `src/io.ts:13`
- Cause: Current implementation targets small Design Markdown files and uses simple `readFile()` / `JSON.stringify()` helpers.
- Improvement path: Add an input size limit before reading or before writing raw archives. If larger inputs become normal, separate raw archival from builder output generation and avoid duplicating raw text into every workflow.

**Whiffler scan execution has a fixed output buffer:**
- Problem: `runWhiffler()` allows up to 10 MB of stdout and parses the result in one `JSON.parse()` call.
- Files: `src/technology.ts:82`, `src/technology.ts:83`, `src/technology.ts:85`
- Cause: The command expects Whiffler JSON to fit comfortably in memory.
- Improvement path: Keep the current buffer for local CLI use, but expose a clear error when output exceeds the buffer and add a fixture test for large or malformed Whiffler JSON.

## Fragile Areas

**`src/scrub.ts` concentrates many responsibilities:**
- Files: `src/scrub.ts:20`, `src/scrub.ts:74`, `src/scrub.ts:86`, `src/scrub.ts:129`, `src/scrub.ts:317`, `src/scrub.ts:347`
- Why fragile: One file owns source archiving, scrubbing, palette run creation, technology context attachment, DNA construction, markdown output, and heuristic inference. Changes to privacy behavior can accidentally affect output shape or palette behavior.
- Safe modification: Split new work along existing helper boundaries: redaction in `scrubSourceText()` / `extractIdentityTerms()`, artifact shape in `buildDesignDna()` / markdown builders, integration behavior in `maybeBuildTechnologyContext()`.
- Test coverage: Current tests cover one fixture and basic identity removal in `test/cli.test.js:27`; add adversarial fixtures before broadening source ingestion.

**Pidge handoff writes side effects inside the input run directory:**
- Files: `src/pidge.ts:92`, `src/pidge.ts:98`, `src/pidge.ts:101`, `src/pidge.ts:138`
- Why fragile: Every handoff creates `<run>/pidge/payload-*.json`; repeated sends mutate the source run directory and can be picked up by later tooling if directory scans are added.
- Safe modification: Keep handoff payloads under a clearly ignored or separate operational directory, or add explicit cleanup/retention commands.
- Test coverage: Pidge dry-run and real-send behavior is covered in `test/cli.test.js:87` and `test/cli.test.js:120`, but retention and repeated sends are not covered.

## Scaling Limits

**Variant generation has a hard cap and fixed hue offsets:**
- Current capacity: `buildPaletteRun()` clamps variants to 1-12 and uses a fixed 12-item offset list.
- Limit: Requests above 12 silently emit 12 variants, and there is no seed-aware palette variation beyond validating the seed hex in the CLI.
- Scaling path: Preserve the clamp for CLI safety, but report clamping to users and add seed-driven palette generation before exposing larger batch workflows.
- Files: `src/color.ts:139`, `src/color.ts:148`, `src/color.ts:168`, `src/cli.ts:112`, `src/cli.ts:114`

**Only Design Markdown ingestion is implemented:**
- Current capacity: `scrub-md`, `palette`, `export`, `tech-scan`, `handoff`, and `css-vars` are implemented.
- Limit: Planned URL, image, screenshot, raw-reference scrub, and API flows are documented but not implemented.
- Scaling path: Treat `scrub-md` as the stable CLI path; add each new input type behind its own command with fixture coverage and privacy tests.
- Files: `README.md:21`, `README.md:129`, `START-HERE.md:20`, `START-HERE.md:60`, `HANDOFF.md:13`

## Dependencies at Risk

**Local Whiffler and Pidge are operational dependencies, not package dependencies:**
- Risk: Normal package installation does not install Whiffler or Pidge, but `tech-scan --url`, `scrub-md --tech-url`, and non-dry-run `handoff` depend on them.
- Impact: Core palette/scrub/export commands work after `npm install`, but integration commands can fail on clean machines.
- Migration plan: Document install requirements, support `RIFF_WHIF_FLIER` / `PIDGE_BIN` style env overrides, and keep fixture-based tests independent from local absolute paths.
- Files: `package.json:18`, `src/technology.ts:68`, `src/pidge.ts:10`, `README.md:85`, `README.md:97`

**No production dependency vulnerabilities detected:**
- Risk: `npm audit --omit=dev --json` reports zero vulnerabilities for current production dependencies.
- Impact: Dependency risk is currently low, but `commander` and `culori` still need routine update review.
- Migration plan: Keep `package-lock.json` committed and rerun `npm audit --omit=dev` during release checks.
- Files: `package.json:22`, `package-lock.json`

## Missing Critical Features

**No CI configuration is present:**
- Problem: Tests pass locally, but no GitHub Actions or equivalent CI config was detected in the repository scan.
- Blocks: Automated verification for Node 22, TypeScript build, tests, smoke command, and audit on PRs.
- Files: `package.json:11`, `package.json:16`, `HANDOFF.md:24`

**No generated-run ignore policy is documented in repository config:**
- Problem: The CLI generates run outputs containing private `raw-reference.json`, but the repo-level ignore policy was not represented in the scanned docs beyond prose warnings.
- Blocks: Safe routine use inside git worktrees where generated outputs may be accidentally staged.
- Files: `src/scrub.ts:58`, `README.md:36`, `README.md:117`

**No API/auth boundary exists for future service mode:**
- Problem: The current project is CLI-only, but docs mention a possible local API. Existing command handlers assume local trusted execution and direct filesystem writes.
- Blocks: Exposing RizzFizz as a service without adding authentication, path sandboxing, upload limits, URL allow/deny policy, and output segregation.
- Files: `START-HERE.md:47`, `START-HERE.md:60`, `src/cli.ts:17`, `src/io.ts:8`

## Test Coverage Gaps

**Adversarial privacy scrubbing:**
- What's not tested: Phone numbers, physical addresses, social handles, non-labeled brands, source-specific slogans, multiple URLs, emails outside simple ASCII, and distinctive long-form copy.
- Files: `test/cli.test.js:27`, `src/scrub.ts:111`, `src/scrub.ts:347`
- Risk: Private identity leaks into builder-facing artifacts despite the source-safe contract.
- Priority: High

**Error paths and invalid inputs:**
- What's not tested: Invalid palette JSON, missing run files, malformed Whiffler JSON, nonexistent Whiffler/Pidge paths, unsupported export formats, bad agent names, and invalid option values.
- Files: `src/cli.ts:53`, `src/cli.ts:139`, `src/pidge.ts:185`, `src/schemas.ts:24`, `src/technology.ts:85`
- Risk: CLI users get unhelpful failures or partial output without coverage guarding command behavior.
- Priority: Medium

**Integration behavior depends on local tools:**
- What's not tested: `tech-scan --url` with real Whiffler, timeout behavior, network failure behavior, and Pidge command lookup through `PATH`.
- Files: `test/cli.test.js:67`, `test/cli.test.js:120`, `src/technology.ts:70`, `src/pidge.ts:36`
- Risk: Local tests pass while documented integration commands fail in a clean environment.
- Priority: Medium

**Verification status during mapping:**
- `npm test` passes 11 tests.
- `npm audit --omit=dev --json` reports 0 vulnerabilities.
- Files: `package.json:16`, `test/cli.test.js`, `test/color.test.js`

---

*Concerns audit: 2026-05-09*
