# Coding Conventions

**Analysis Date:** 2026-05-09

## Naming Patterns

**Files:**
- Use lowercase module names for source files under `src/`, such as `src/color.ts`, `src/scrub.ts`, `src/technology.ts`, and `src/pidge.ts`.
- Use `.d.ts` declaration shims only for interoperability gaps, as in `src/culori.d.ts` and `src/node-shims.d.ts`.
- Use JavaScript test files under `test/` because tests import compiled output from `dist/`, as in `test/color.test.js` and `test/cli.test.js`.
- Use descriptive fixture names under `test/fixtures/`, such as `test/fixtures/DESIGN-source.md` and `test/fixtures/waffle-scan.json`.

**Functions:**
- Use `camelCase` for exported functions and private helpers: `buildPaletteRun`, `parseHexToOklch`, `scrubDesignMarkdown`, `buildTechnologyContext`, `sendPidgeHandoff`.
- Prefix transformation builders with `build*` when returning structured artifacts: `buildRawReference` in `src/scrub.ts`, `buildTechnologyContext` in `src/technology.ts`.
- Prefix validators/parsers with `parse*`, `expect*`, or `normalize*`: `parsePositiveInt` in `src/cli.ts:171`, `expectRecord` in `src/schemas.ts:87`, `normalizeHueFamily` in `src/color.ts`.
- Keep private helpers unexported unless tests or other modules need them. Examples: `relativeLuminance` in `src/color.ts`, `recommendFromDetected` in `src/technology.ts`.

**Variables:**
- Use `const` by default. Use `let` only for intentional mutation, such as `text` in `scrubSourceText` at `src/scrub.ts:112` and `stackFit` in `src/technology.ts:132`.
- Use explicit domain nouns for structured values: `paletteRun`, `rawReference`, `technologyContext`, `selectedVariants`, `sourcePath`, `outDir`.
- Use snake_case only for emitted schema fields that are part of JSON artifacts, such as `created_at`, `hue_family`, `palette_relationship`, and `raw_reference_included` in `src/types.ts` and `src/pidge.ts`.

**Types:**
- Use exported `type` aliases for public data contracts in `src/types.ts`: `PaletteTokens`, `ContrastCheck`, `PaletteRelationship`, `PaletteVariant`, `PaletteRun`, `RawReference`.
- Keep module-local option/result types beside the implementation when they are not shared globally, such as `ScrubOptions` in `src/scrub.ts:8` and `PidgeHandoffOptions` in `src/pidge.ts`.
- Use literal schema/version string types for emitted artifacts, such as `schema: "rizzfizz.palette-run.v1"` in `src/types.ts`.
- Prefer `Record<string, unknown>` for flexible JSON-like internal sections where the output shape is intentionally broad, as in `buildDesignDna` in `src/scrub.ts:129`.

## Code Style

**Formatting:**
- No formatter config is present. Preserve the existing style: two-space indentation, semicolons, double quotes, trailing commas omitted.
- Keep object literals and arrays readable with one property per line for artifact schemas and CLI option objects, as in `src/cli.ts:29` and `src/pidge.ts`.
- Use early throws for invalid input rather than nested conditionals, as in `parsePositiveInt` at `src/cli.ts:171` and `expectHex` at `src/schemas.ts:112`.
- Avoid comments for obvious code. Current source uses almost no inline comments; prefer clear function names and structured helper functions.

**Linting:**
- No ESLint, Prettier, or Biome configuration is detected.
- Enforce quality through TypeScript strict mode in `tsconfig.json:6`, build checks in `package.json:14`, and tests in `package.json:16`.
- Use `npm run check` before committing TypeScript changes. It runs `tsc -p tsconfig.json --noEmit` after the Node 22 precheck.

## Import Organization

**Order:**
1. External packages first, such as `commander` in `src/cli.ts:1` and `culori` via `src/culori-require.ts`.
2. Node built-ins with the `node:` prefix, such as `node:path`, `node:fs/promises`, and `node:child_process`.
3. Local value imports using explicit `.js` extensions, such as `./pidge.js`, `./color.js`, and `./io.js`.
4. Local type imports with `import type`, either separated or grouped with `type` specifiers, as in `src/scrub.ts:5` and `src/types.ts`.

**Path Aliases:**
- Not detected. `tsconfig.json` has no `paths` aliases. Use relative imports inside `src/`.
- Because `module` and `moduleResolution` are `NodeNext` in `tsconfig.json:4`, TypeScript source imports local modules with runtime `.js` extensions.

## Error Handling

**Patterns:**
- Throw `Error` with concrete user-facing messages for invalid CLI arguments and malformed data, as in `src/cli.ts:53`, `src/cli.ts:139`, and `src/schemas.ts:27`.
- For CLI entrypoint errors, catch `unknown`, normalize to a message, write to stderr, and set `process.exitCode = 1` in `src/cli.ts:165`.
- For schema parsing, use small `expect*` helpers that validate one primitive at a time and include a path-like label in failures, as in `src/schemas.ts:87` and `src/technology.ts:162`.
- For optional filesystem checks, catch access failures and return booleans through an `exists` helper, as in `src/pidge.ts` and `src/exports.ts`.
- For external command execution, use `execFile` with argument arrays rather than shell interpolation, as in `src/technology.ts:82` and `src/pidge.ts`.

## Logging

**Framework:** console

**Patterns:**
- CLI commands print concise completion lines to stdout after writing artifacts, such as `Wrote palette run` in `src/cli.ts:122` and `Wrote technology context` in `src/cli.ts:65`.
- CLI errors use stderr through `console.error` in `src/cli.ts:167`.
- Library modules do not log. Return values and thrown errors carry status back to `src/cli.ts`.
- Tests assert stdout for CLI behavior where output is part of the integration contract, such as `test/cli.test.js:104`.

## Comments

**When to Comment:**
- Comment only when a local rule is not obvious from names or types. Current code relies on descriptive identifiers rather than comments.
- Do not add narration comments around straightforward artifact assembly or helper calls.

**JSDoc/TSDoc:**
- Not used. Public contracts are communicated through TypeScript exported types in `src/types.ts`, `src/pidge.ts`, and `src/technology.ts`.

## Function Design

**Size:** 
- Keep exported functions focused on one workflow step: `buildPaletteRun` creates palette runs in `src/color.ts`; `scrubDesignMarkdown` coordinates the scrub pipeline in `src/scrub.ts`; `sendPidgeHandoff` coordinates handoff packaging in `src/pidge.ts`.
- For larger transformations, split parsing, selection, formatting, and writing into private helpers. Examples: `maybeBuildTechnologyContext`, `buildRawReference`, `scrubSourceText`, and `buildDesignDna` in `src/scrub.ts`.

**Parameters:** 
- Use a single options object for exported async workflow functions with multiple inputs: `scrubDesignMarkdown(options: ScrubOptions)` in `src/scrub.ts:20`, `runWhiffler(options)` in `src/technology.ts:70`, and `sendPidgeHandoff(options)` in `src/pidge.ts`.
- Use positional parameters only for simple pure helpers, such as `contrastRatio(foreground, background)` and `interpolateOklch(a, b, t, easing)` in `src/color.ts`.

**Return Values:** 
- Return explicit domain types or `Promise<void>` for writers. Examples: `PaletteRun` from `buildPaletteRun`, `TechnologyContext` from `buildTechnologyContext`, `Promise<void>` from `exportCssVars`.
- Include generated paths in workflow result objects when callers need them, as in `scrubDesignMarkdown` returning `{ outDir, paletteRun }` and `sendPidgeHandoff` returning `payloadPath`, `attachments`, `command`, `stdout`, and `dryRun`.

## Module Design

**Exports:** 
- Keep CLI wiring in `src/cli.ts`; do not put domain logic there beyond option validation and command dispatch.
- Put filesystem primitives in `src/io.ts`; use `readText`, `writeText`, `writeJson`, and `readJson` rather than duplicating JSON/file handling.
- Put schema validation in `src/schemas.ts` and module-specific validators in the module that owns the external shape, such as `waffleScanSchema` in `src/technology.ts`.
- Keep data contracts in `src/types.ts` when shared by multiple modules.

**Barrel Files:** 
- `src/exports.ts` is an implementation module for export formats, not a barrel file.
- No generic barrel export file is detected. Prefer direct module imports.

## Quality Commands

```bash
npm run check        # TypeScript strict typecheck, no emit
npm run build        # Compile src/ to dist/ and declarations
npm test             # Build, then run node --test over test/*.test.js
npm run smoke        # Build and exercise palette + export CLI paths
```

## Coverage Gaps To Consider When Editing

- Add negative-path tests when changing validators in `src/schemas.ts`, `src/technology.ts`, or `src/cli.ts`; current tests mostly cover successful flows.
- Add direct tests for `scrubSourceText` and identity extraction behavior when changing scrub logic in `src/scrub.ts`; current coverage exercises the behavior only through `scrub-md` CLI integration.
- Add tests for external command failures and missing executable paths when changing `src/technology.ts` or `src/pidge.ts`; current CLI tests use fixtures and a local Pidge path.

---

*Convention analysis: 2026-05-09*
