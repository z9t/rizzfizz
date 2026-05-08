# Coding Conventions

**Analysis Date:** 2026-05-09

## Naming Patterns

**Files:**
- Use lower-case feature/module names for implementation files: `src/color.ts`, `src/scrub.ts`, `src/technology.ts`, `src/pidge.ts`.
- Use `.d.ts` only for ambient/module declarations: `src/culori.d.ts`, `src/node-shims.d.ts`.
- Use JavaScript test files named by feature: `test/color.test.js`, `test/cli.test.js`.

**Functions:**
- Use camelCase named exports for public functions: `buildPaletteRun`, `parseHexToOklch`, `cssVarsForPalette` in `src/color.ts`.
- Use local helper functions as non-exported camelCase functions below the public API: `expectRecord`, `expectArray`, `expectString` in `src/schemas.ts`; `parseTechnology`, `parseEvidence` in `src/technology.ts`.
- Use command action helpers for CLI parsing and validation, not inline anonymous logic when reused: `parsePositiveInt` in `src/cli.ts`.

**Variables:**
- Use camelCase for local variables and options objects: `sourcePath`, `outDir`, `paletteRun`, `technologyContext` in `src/scrub.ts`.
- Use SCREAMING_SNAKE_CASE for module constants and regular expressions: `HUE_FAMILIES`, `RELATIONSHIPS` in `src/color.ts`; `HEX_RE` in `src/schemas.ts`; `DEFAULT_WHIFFLER` in `src/technology.ts`.
- Use snake_case only for serialized schema fields that become JSON artifacts: `created_at`, `hue_family`, `accent_strong`, `palette_relationship` in `src/types.ts`.

**Types:**
- Use exported PascalCase type aliases for domain shapes: `PaletteTokens`, `PaletteRun`, `RawReference` in `src/types.ts`; `WaffleScan`, `TechnologyContext` in `src/technology.ts`.
- Prefer literal schema discriminators in types and runtime parsers: `schema: "rizzfizz.palette-run.v1"` in `src/types.ts` and `src/schemas.ts`.
- Use `unknown` at external input boundaries, then validate before casting: `paletteRunSchema.parse(value: unknown)` in `src/schemas.ts`; `waffleScanSchema.parse(value: unknown)` in `src/technology.ts`.

## Code Style

**Formatting:**
- No Prettier or Biome config is detected.
- Use two-space indentation in JSON and TypeScript, matching `package.json`, `tsconfig.json`, and `src/*.ts`.
- Keep semicolons enabled and use double quotes for strings/imports, matching `src/cli.ts`, `src/color.ts`, and `test/*.js`.
- Use trailing commas sparingly; current object and array literals generally omit trailing commas.
- Keep files ASCII unless an existing source file requires otherwise.

**Linting:**
- No ESLint config is detected.
- The quality gate is TypeScript strict checking via `npm run check`, which runs `tsc -p tsconfig.json --noEmit` from `package.json`.
- Preserve `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and `declaration: true` in `tsconfig.json` unless the package output model changes.

## Import Organization

**Order:**
1. External packages first: `commander` in `src/cli.ts`, `culori` via `src/culori-require.ts` in `src/color.ts`.
2. Node built-ins next using the `node:` prefix: `node:path`, `node:fs/promises`, `node:child_process`.
3. Local runtime imports next with explicit `.js` extensions for NodeNext ESM: `./color.js`, `./io.js`, `./schemas.js`.
4. Type-only imports last or grouped separately with `import type`: `import type { PaletteRun } from "./types.js"`.

**Path Aliases:**
- Not detected. Use relative imports with explicit `.js` suffixes in TypeScript source because `tsconfig.json` uses NodeNext modules.

## Error Handling

**Patterns:**
- Throw `Error` with actionable messages for invalid CLI arguments, invalid colors, invalid schema payloads, and missing variants: `src/cli.ts`, `src/color.ts`, `src/schemas.ts`, `src/pidge.ts`.
- Keep boundary validation close to parsing: schema helpers in `src/schemas.ts` and `src/technology.ts` check shape, primitive type, enum membership, and hex format before returning typed data.
- CLI entrypoint catches `unknown`, prints a normalized `rizzfizz: ...` message, and sets `process.exitCode = 1` instead of throwing through Node internals in `src/cli.ts`.
- Filesystem and external executable checks use `access()` before execution where the missing path is a user-facing failure mode: `src/pidge.ts`, `src/technology.ts`.

## Logging

**Framework:** console

**Patterns:**
- CLI success paths print concise artifact paths and counts with `console.log` in `src/cli.ts`.
- CLI failure path prints only the normalized error message with `console.error` in `src/cli.ts`.
- Library modules under `src/` should not log directly; return values or throw errors and let `src/cli.ts` handle user output.

## Comments

**When to Comment:**
- Comments are minimal in current source. Prefer descriptive names and structured return data over comments.
- Add comments only for non-obvious boundary decisions, especially source-safety, schema compatibility, or external tool behavior.

**JSDoc/TSDoc:**
- Not used. Do not introduce broad docblock style unless the public API surface grows enough to need generated API docs.

## Function Design

**Size:** Keep pure transformation helpers small and composable where possible: `normalizeHueFamily`, `normalizeRelationship`, `contrastRatio`, and `paletteUsage` in `src/color.ts`.

**Parameters:** Use typed options objects for workflows with several inputs: `buildPaletteRun(options)`, `scrubDesignMarkdown(options)`, `runWhiffler(options)`, and `sendPidgeHandoff(options)`.

**Return Values:** Return concrete domain objects from library functions and reserve process output for `src/cli.ts`. Async workflow functions should return typed promises such as `Promise<WaffleScan>` or `Promise<PidgeHandoffResult>`.

## Module Design

**Exports:**
- Export domain functions from focused modules: palette logic in `src/color.ts`, artifact exporters in `src/exports.ts`, scrub workflow in `src/scrub.ts`, external scan logic in `src/technology.ts`, Pidge handoff logic in `src/pidge.ts`.
- Keep parser/helper primitives private unless another module needs them; examples are `expectString` in `src/schemas.ts` and `parseTechnology` in `src/technology.ts`.

**Barrel Files:**
- `src/exports.ts` is not a package barrel; it owns export artifact generation.
- No general `index.ts` barrel is present. Import directly from the owning module.

---

*Convention analysis: 2026-05-09*
