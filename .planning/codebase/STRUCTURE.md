# Codebase Structure

**Analysis Date:** 2026-05-09

## Directory Layout

```text
rizzfizz/
├── bin/                         # Package executable shim
├── dist/                        # TypeScript build output
├── src/                         # TypeScript source modules
├── test/                        # Node test suites and fixtures
│   └── fixtures/                # Design Markdown and Whiffler JSON fixtures
├── scripts/                     # Development/runtime guard scripts
├── GitHubPalleteRepos/          # Reference and research material
├── .planning/codebase/          # GSD codebase maps
├── package.json                 # Package metadata, scripts, dependencies, bin
├── package-lock.json            # npm lockfile
├── tsconfig.json                # TypeScript compiler settings
└── README.md                    # Project documentation
```

## Directory Purposes

**`src/`:**
- Purpose: All authored TypeScript implementation lives here.
- Contains: CLI command registration, palette logic, scrub pipeline, exports, integrations, schemas, shared types, file IO helpers, compatibility shims.
- Key files: `src/cli.ts`, `src/color.ts`, `src/scrub.ts`, `src/exports.ts`, `src/technology.ts`, `src/pidge.ts`, `src/schemas.ts`, `src/types.ts`, `src/io.ts`.

**`bin/`:**
- Purpose: npm package executable entrypoint.
- Contains: `bin/cli.js`, a small ESM shim that imports compiled `dist/cli.js`.
- Key files: `bin/cli.js`.

**`dist/`:**
- Purpose: Build output from `tsc -p tsconfig.json`.
- Contains: Emitted JavaScript and declaration files from `src/`.
- Key files: Generated files corresponding to `src/*.ts`.

**`test/`:**
- Purpose: Node test suites for CLI workflows and palette core behavior.
- Contains: JavaScript tests that import compiled `dist/*` modules or run `bin/cli.js`.
- Key files: `test/cli.test.js`, `test/color.test.js`, `test/fixtures/DESIGN-source.md`, `test/fixtures/waffle-scan.json`.

**`scripts/`:**
- Purpose: Development guard scripts used by npm lifecycle scripts.
- Contains: Node version enforcement.
- Key files: `scripts/require-node22.mjs`.

**`GitHubPalleteRepos/`:**
- Purpose: Reference/research inputs for palette generation and website stack analysis.
- Contains: Markdown/text/json analysis artifacts.
- Key files: `GitHubPalleteRepos/colourselect_techreqs.md`, `GitHubPalleteRepos/color_generator_analysis.md`, `GitHubPalleteRepos/GithubPaletteGenSearch.txt`.

**`.planning/codebase/`:**
- Purpose: GSD-generated maps consumed by planning and execution commands.
- Contains: Architecture/structure docs and other focus-area maps when generated.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `bin/cli.js`: Executable package shim importing `../dist/cli.js`.
- `src/cli.ts`: Commander program and command action registration.

**Configuration:**
- `package.json`: npm scripts, package bin, runtime dependencies, Node engine.
- `tsconfig.json`: ESM/NodeNext TypeScript compile settings, `rootDir: src`, `outDir: dist`.
- `package-lock.json`: Locked npm dependency graph.

**Core Logic:**
- `src/color.ts`: Palette relationship presets, hue presets, OKLCH conversion, contrast checks, CSS variable output.
- `src/scrub.ts`: Design Markdown intake, raw-reference preservation, identity scrubbing, design DNA and run artifact creation.
- `src/exports.ts`: A-Eyes token export, CSS export, builder-brief export.
- `src/technology.ts`: Waffle Whiffler scan execution/parsing and technology-context recommendations.
- `src/pidge.ts`: Agent handoff payload, attachment collection, and Pidge command execution.

**Contracts:**
- `src/types.ts`: Canonical TypeScript types for palette and raw-reference artifacts.
- `src/schemas.ts`: Runtime parsers for palette token and palette run JSON.
- `src/technology.ts`: Runtime parser and types for Whiffler scan JSON and technology context.

**Utilities:**
- `src/io.ts`: Shared text/JSON read and write helpers.
- `src/culori-require.ts`: Culori CommonJS interop shim.
- `src/culori.d.ts`, `src/node-shims.d.ts`: Type declaration support.

**Testing:**
- `test/cli.test.js`: End-to-end CLI workflow coverage for palette, scrub, export, tech-scan, and handoff.
- `test/color.test.js`: Unit coverage for color conversion, interpolation, easing, contrast, and palette generation.
- `test/fixtures/DESIGN-source.md`: Source Design Markdown fixture.
- `test/fixtures/waffle-scan.json`: Waffle Whiffler scan fixture.

## Naming Conventions

**Files:**
- Use short lowercase module names for source modules: `src/color.ts`, `src/scrub.ts`, `src/exports.ts`, `src/technology.ts`.
- Use `.test.js` for Node test files under `test/`.
- Use generated artifact names that match command output contracts: `palette-run.json`, `scrubbed-design-dna.json`, `variants-palette.json`, `tokens.css`, `builder-briefs/*.md`.

**Directories:**
- Use singular root directories for code domains: `src/`, `test/`, `scripts/`, `bin/`.
- Use `test/fixtures/` for reusable fixture files.
- Use command output directories supplied by callers for generated run artifacts; do not create hard-coded output roots in source.

**Exports and Functions:**
- Export library functions from their owning module, not from `src/cli.ts`.
- Use verb-first names for actions: `buildPaletteRun`, `scrubDesignMarkdown`, `exportAgentBriefs`, `runWhiffler`, `sendPidgeHandoff`.
- Keep type names domain-specific and PascalCase: `PaletteRun`, `PaletteVariant`, `TechnologyContext`, `PidgeHandoffOptions`.

## Where to Add New Code

**New CLI Command:**
- Primary code: Add command registration and option parsing in `src/cli.ts`.
- Behavior: Put implementation in a focused module under `src/`; avoid long command action bodies.
- Tests: Add CLI workflow coverage in `test/cli.test.js`.

**New Palette Relationship or Hue Family:**
- Primary code: Add presets and token generation in `src/color.ts`.
- Technology guidance: Add or update builder stack mapping in `src/exports.ts`.
- Contracts: Update `src/types.ts` only if the data shape changes.
- Tests: Add generation/contrast coverage in `test/color.test.js` and CLI/export checks in `test/cli.test.js` if output changes.

**New Generated Artifact In `scrub-md`:**
- Primary code: Add artifact construction and writes in `src/scrub.ts`.
- Schema/types: Add shared contract in `src/types.ts` and runtime parser in `src/schemas.ts` if another command reads the artifact later.
- Handoff/export: Include the artifact in `src/pidge.ts` or `src/exports.ts` only when it is builder-safe or explicitly requested.
- Tests: Assert file creation and privacy behavior in `test/cli.test.js`.

**New Export Format:**
- Primary code: Add export function in `src/exports.ts`.
- CLI wiring: Add `--format` branch in `src/cli.ts`.
- Validation: Parse input JSON with existing or new schema before writing output.
- Tests: Add an export command case in `test/cli.test.js`.

**New External Tool Integration:**
- Primary code: Add a dedicated module under `src/` if the integration is large; keep `src/technology.ts` for Waffle Whiffler-specific behavior and `src/pidge.ts` for Pidge-specific behavior.
- Execution: Use `execFile` with argument arrays, not shell strings.
- Validation: Add runtime parser for tool output before using it downstream.
- Tests: Prefer fixture-driven tests under `test/fixtures/` for parsed output and isolated temp directories for CLI flows.

**Utilities:**
- Shared helpers: Put filesystem helpers in `src/io.ts` only when they are generic text/JSON IO.
- Domain helpers: Keep private helpers inside the owning module until they are genuinely reused.

## Module Boundaries

**`src/cli.ts`:**
- Owns command names, user-facing options, default CLI option values, success/error logging.
- Must not own design DNA construction, palette algorithms, export rendering, or external tool parsing.

**`src/color.ts`:**
- Owns color math, palette presets, variant generation, contrast validation, and CSS variable serialization.
- Must not read/write files directly.

**`src/scrub.ts`:**
- Owns source Design Markdown intake and full run directory generation.
- May call palette, technology, export, and IO modules.
- Must preserve source-safe separation between `raw-reference.json` and builder-facing outputs.

**`src/exports.ts`:**
- Owns conversions from existing run/palette artifacts into builder-consumable formats.
- Should parse external inputs with `paletteRunSchema` before rendering.

**`src/technology.ts`:**
- Owns Waffle Whiffler subprocess invocation and scan-to-context normalization.
- Should not decide final website implementation; recommendations are guidance for briefs.

**`src/pidge.ts`:**
- Owns handoff payload shape, attachment selection, agent-name validation, and Pidge command construction/execution.
- Should not generate new design or palette content; read existing run artifacts.

**`src/types.ts` and `src/schemas.ts`:**
- Own artifact contracts and boundary validation.
- Add schema/version fields when introducing new JSON artifact types.

## Special Directories

**`dist/`:**
- Purpose: TypeScript compiler output consumed by `bin/cli.js` and tests.
- Generated: Yes.
- Committed: Present in the working tree; regenerate with `npm run build`.

**`node_modules/`:**
- Purpose: Installed npm dependencies.
- Generated: Yes.
- Committed: No.

**`.planning/codebase/`:**
- Purpose: Generated codebase intelligence for GSD workflows.
- Generated: Yes.
- Committed: Project-dependent; only edit owned map files for the active focus.

**`GitHubPalleteRepos/`:**
- Purpose: Reference analysis and research material.
- Generated: Mixed; treat as input/reference unless the task explicitly asks to update it.
- Committed: Present in the working tree.

---

*Structure analysis: 2026-05-09*
