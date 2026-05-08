<!-- refreshed: 2026-05-09 -->
# Architecture

**Analysis Date:** 2026-05-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry Layer                       │
│            `bin/cli.js` -> `dist/cli.js` -> `src/cli.ts`      │
├───────────────┬──────────────┬──────────────┬───────────────┤
│  `scrub-md`   │ `palette`    │ `export`     │ `tech-scan` / │
│               │ `css-vars`   │              │ `handoff`     │
└───────┬───────┴──────┬───────┴──────┬───────┴───────┬───────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Scrub/Run    │ │ Palette Core │ │ Export Core  │ │ Integrations │
│ `src/scrub.ts`│ │ `src/color.ts`│ │`src/exports.ts`││`technology.ts`│
└───────┬──────┘ └──────┬───────┘ └──────┬───────┘ │ `pidge.ts`   │
        │               │                │          └──────┬───────┘
        ▼               ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Shared Contracts & IO                     │
│        `src/types.ts`, `src/schemas.ts`, `src/io.ts`          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Run Artifacts / External Tools               │
│  JSON/Markdown/CSS outputs, Waffle Whiffler, Pidge message bus│
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI router | Defines commands, parses options, calls focused library functions, and reports output paths. | `src/cli.ts` |
| Executable shim | Loads compiled CLI from the package `bin` entry. | `bin/cli.js` |
| Palette engine | Normalizes relationship/hue inputs, generates OKLCH palettes, validates contrast, and emits CSS vars. | `src/color.ts` |
| Scrub pipeline | Reads Design Markdown, preserves private raw reference, removes source identity, builds design DNA, variants, tokens, briefs, and optional tech context. | `src/scrub.ts` |
| Export pipeline | Converts palette runs or scrub-run directories into A-Eyes tokens, CSS vars, and builder briefs. | `src/exports.ts` |
| Technology context | Reads or runs Waffle Whiffler scans and summarizes detections into builder-safe recommendations. | `src/technology.ts` |
| Pidge handoff | Packages scrub-run artifacts for agent handoff and sends or dry-runs `pidge send`. | `src/pidge.ts` |
| Runtime schemas | Validates palette runs/tokens and Whiffler input shapes at IO boundaries. | `src/schemas.ts`, `src/technology.ts` |
| Shared types | Defines canonical palette and raw-reference data contracts. | `src/types.ts` |
| File IO | Centralizes UTF-8 text and JSON reads/writes with recursive directory creation. | `src/io.ts` |

## Pattern Overview

**Overall:** CLI-first functional pipeline with JSON/Markdown/CSS artifacts as durable boundaries.

**Key Characteristics:**
- Keep command declarations and option defaults in `src/cli.ts`; place behavior in importable modules.
- Treat `src/types.ts` and `src/schemas.ts` as the stable contracts for generated artifacts.
- Use caller-provided output directories as the state boundary between commands.
- Keep private raw source archives separate from builder-facing outputs and handoffs.
- Execute external tools with `execFile` argument arrays, not shell command strings.

## Layers

**CLI Layer:**
- Purpose: Parse user intent and dispatch to library functions.
- Location: `src/cli.ts`, `bin/cli.js`
- Contains: Commander command definitions for `scrub-md`, `tech-scan`, `handoff`, `palette`, `export`, and `css-vars`.
- Depends on: `src/color.ts`, `src/scrub.ts`, `src/exports.ts`, `src/technology.ts`, `src/pidge.ts`, `src/io.ts`.
- Used by: Package binary `rizzfizz` via `bin/cli.js`.

**Domain Core:**
- Purpose: Generate palette and design-intelligence artifacts without owning CLI parsing.
- Location: `src/color.ts`, `src/scrub.ts`, `src/exports.ts`
- Contains: Palette generation, source scrubbing, design DNA construction, builder-brief rendering, export format conversion.
- Depends on: `src/types.ts`, `src/schemas.ts`, `src/io.ts`, optional `src/technology.ts`.
- Used by: `src/cli.ts`, `test/cli.test.js`, `test/color.test.js`.

**Integration Layer:**
- Purpose: Normalize external tool output and route generated artifacts to other agents.
- Location: `src/technology.ts`, `src/pidge.ts`
- Contains: Waffle Whiffler subprocess execution/scan parsing, Pidge payload construction, Pidge subprocess execution.
- Depends on: Node `child_process`, `fs/promises`, `src/io.ts`, `src/schemas.ts`.
- Used by: `src/cli.ts`, `src/scrub.ts`, `test/cli.test.js`.

**Contracts & IO:**
- Purpose: Hold shared data shapes and boundary validation.
- Location: `src/types.ts`, `src/schemas.ts`, `src/io.ts`
- Contains: `PaletteRun`, `PaletteVariant`, `RawReference`, palette validators, JSON/text helpers.
- Depends on: Node filesystem APIs only.
- Used by: All modules that read/write structured artifacts.

## Data Flow

### Primary Request Path: `scrub-md`

1. CLI receives Design Markdown path, output directory, palette options, and optional technology scan flags (`src/cli.ts:17`).
2. `scrubDesignMarkdown` resolves paths, reads source text, builds `RawReference`, scrubs identity terms, infers relationship/hue, and generates a `PaletteRun` (`src/scrub.ts:20`).
3. Optional technology context is loaded from Whiffler JSON or produced by running Whiffler (`src/scrub.ts:74`, `src/technology.ts:70`).
4. The pipeline writes private and builder-facing artifacts: `raw-reference.json`, `scrubbed-design-dna.json`, `DESIGN-neutral.md`, `DESIGN-variant-*.md`, `design-md-variation-run.json`, `palette-run.json`, `tokens.css`, `variants-palette.json`, optional `technology-context.json`, and `builder-briefs/*.md` (`src/scrub.ts:58`).

### Palette Generation Path

1. CLI validates optional seed and normalizes `--relationship` / `--hue` (`src/cli.ts:106`).
2. `buildPaletteRun` clamps variant count to 1-12, offsets hue families, and builds variants (`src/color.ts:139`).
3. Each variant selects relationship tokens, validates contrast pairs, and throws on required failures (`src/color.ts:173`, `src/color.ts:255`).
4. `writeJson` persists the palette run or `cssVarsForPalette` emits CSS variables (`src/io.ts:13`, `src/color.ts:290`).

### Export Path

1. CLI routes `--format` to `exportAEyesTokens`, `exportAgentBriefs`, or `exportCssVars` (`src/cli.ts:125`).
2. Export functions parse `palette-run.json` through `paletteRunSchema` before writing derived artifacts (`src/exports.ts:26`, `src/schemas.ts:24`).
3. Agent briefs combine palette variants, design DNA, and optional technology context into Markdown (`src/exports.ts:36`, `src/exports.ts:59`).

### Technology Scan Path

1. `tech-scan` requires either `--input` Whiffler JSON or `--url` (`src/cli.ts:44`).
2. Existing scans are parsed by `readWhifflerScan`; URL scans execute `node <whiffler> --json` through `execFile` (`src/technology.ts:70`, `src/technology.ts:88`).
3. `buildTechnologyContext` filters technologies at confidence >= 30, keeps top detections, and creates recommendations (`src/technology.ts:92`).

### Pidge Handoff Path

1. CLI passes a scrub-run directory and routing options into `sendPidgeHandoff` (`src/cli.ts:68`).
2. `sendPidgeHandoff` validates agent names, parses `palette-run.json`, selects variants, writes a payload, collects attachments, and builds a `pidge send` command (`src/pidge.ts:36`).
3. Dry runs return the command without executing; live runs call the Pidge executable with `execFile` (`src/pidge.ts:70`, `src/pidge.ts:80`).

**State Management:**
- There is no server state or database. State is held in generated files under caller-provided output directories.
- Module-level constants define supported hue families, palette relationships, default executable paths, and validation regexes (`src/color.ts:8`, `src/color.ts:21`, `src/technology.ts:68`, `src/pidge.ts:10`).

## Key Abstractions

**PaletteRun:**
- Purpose: Canonical generated palette artifact with variants and contrast checks.
- Examples: `src/types.ts`, `src/color.ts`, `src/schemas.ts`
- Pattern: TypeScript type plus runtime parser; parse external JSON before export or handoff.

**PaletteRelationship:**
- Purpose: Encodes tone, accent usage, chroma, contrast, and design relationship language.
- Examples: `src/types.ts`, `src/color.ts`
- Pattern: Closed preset map in `RELATIONSHIPS`; add new relationships in `src/color.ts` and update technology direction in `src/exports.ts`.

**RawReference:**
- Purpose: Private archive of unsanitized Design Markdown and extracted identity markers.
- Examples: `src/types.ts`, `src/scrub.ts`
- Pattern: Write raw reference to run output; exclude it from builder-facing handoffs unless explicitly included.

**TechnologyContext:**
- Purpose: Source-site technology evidence summarized for builder guidance.
- Examples: `src/technology.ts`, `src/exports.ts`
- Pattern: Preserve raw Whiffler scan inside context; present detections/recommendations in briefs.

**PidgeHandoffResult:**
- Purpose: Describes a generated agent handoff payload, attachments, command, stdout, and dry-run state.
- Examples: `src/pidge.ts`
- Pattern: Build command arrays and execute with `execFile`.

## Entry Points

**Package CLI:**
- Location: `bin/cli.js`
- Triggers: `rizzfizz` package bin or `node bin/cli.js`.
- Responsibilities: Import compiled `dist/cli.js`.

**Commander Program:**
- Location: `src/cli.ts`
- Triggers: Runtime import from compiled CLI.
- Responsibilities: Define commands, parse args, and convert CLI errors to `rizzfizz: ...` stderr with non-zero exit code (`src/cli.ts:165`).

**Library Functions:**
- Location: `src/color.ts`, `src/scrub.ts`, `src/exports.ts`, `src/technology.ts`, `src/pidge.ts`
- Triggers: CLI commands and tests.
- Responsibilities: Keep core behavior callable outside the CLI.

## Architectural Constraints

- **Runtime:** Node.js ESM with TypeScript `moduleResolution: NodeNext`; source imports use `.js` suffixes for emitted ESM compatibility (`tsconfig.json`, `src/cli.ts`).
- **Threading:** Single Node event loop; parallelism is limited to `Promise.all` for independent file writes in `src/scrub.ts` and `src/exports.ts`.
- **Global state:** Supported hue and relationship presets are module-level constants in `src/color.ts`; default external executables are constants in `src/technology.ts` and `src/pidge.ts`.
- **Circular imports:** No circular dependency chain detected in `src/`; dependencies flow from CLI to domain/integration modules, with shared types/schemas/io at the bottom.
- **Artifact compatibility:** Generated JSON schemas use explicit `schema` fields such as `rizzfizz.palette-run.v1`, `rizzfizz.design-dna.v1`, and `rizzfizz.pidge-handoff.v1`; preserve these when changing output contracts.
- **Privacy boundary:** `raw-reference.json` contains unsanitized source text and must stay out of builder-facing briefs and Pidge attachments unless `--include-raw` is set.

## Anti-Patterns

### Putting Business Logic In `src/cli.ts`

**What happens:** Command actions should only parse options, call library functions, write top-level outputs, and log paths.
**Why it's wrong:** Tests and other agents need importable behavior without invoking the CLI process.
**Do this instead:** Put behavior in modules such as `src/scrub.ts`, `src/color.ts`, `src/exports.ts`, `src/technology.ts`, or `src/pidge.ts`, then call it from `src/cli.ts`.

### Bypassing Runtime Parsers For External JSON

**What happens:** Directly trusting JSON from palette runs or Whiffler scans skips schema checks.
**Why it's wrong:** Export and handoff commands assume valid variants, tokens, and scan shape.
**Do this instead:** Use `paletteRunSchema.parse` for palette inputs (`src/schemas.ts`) and `waffleScanSchema.parse` for technology scans (`src/technology.ts`).

### Leaking Raw Source Into Builder Outputs

**What happens:** Reusing `rawReference.raw_text`, URLs, brand names, or source identity terms in briefs breaks the source-safe contract.
**Why it's wrong:** The tool is designed to preserve abstract design relationships while removing clone/identity markers.
**Do this instead:** Use scrubbed text and design DNA from `src/scrub.ts`; only attach `raw-reference.json` through `src/pidge.ts` when `--include-raw` is explicit.

## Error Handling

**Strategy:** Throw regular `Error` objects from library code; `src/cli.ts` catches command failures, prints a prefixed message, and sets `process.exitCode = 1`.

**Patterns:**
- Validate CLI integers with `parsePositiveInt` before calling library code (`src/cli.ts:171`).
- Throw on invalid color parsing, impossible OKLCH conversion, unsupported export format, invalid agent names, missing variants, and schema mismatches.
- Use `execFile` with argument arrays for Whiffler and Pidge subprocesses (`src/technology.ts:82`, `src/pidge.ts:80`).

## Cross-Cutting Concerns

**Logging:** CLI commands print concise success paths and generated variant/attachment details in `src/cli.ts`.
**Validation:** CLI option validation, palette JSON schema parsing, Whiffler scan parsing, hex color validation, and agent-name regex validation.
**Authentication:** Not applicable in code. External tool access is filesystem/executable based for Waffle Whiffler and Pidge.
**Filesystem:** Use `src/io.ts` for text/JSON files so output directories are created consistently.

---

*Architecture analysis: 2026-05-09*
