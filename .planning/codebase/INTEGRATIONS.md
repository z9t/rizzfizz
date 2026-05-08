# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**Website Technology Fingerprinting:**
- Waffle Whiffler - Optional technology detection feed for source-safe builder briefs.
  - SDK/Client: No package import; `src/technology.ts` invokes the local Whiffler CLI with `execFile("node", [executable, "--json", url])`.
  - Default executable: `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js`.
  - CLI surface: `rizzfizz tech-scan --url <url> --out <path>` and `rizzfizz scrub-md --tech-url <url>`.
  - Auth: Not detected.
  - Network behavior: Network access is delegated to the Whiffler process for the provided URL; RizzFizz itself does not call `fetch`.

**Agent Handoff Bus:**
- Pidge - Optional local agent handoff transport for generated RizzFizz runs.
  - SDK/Client: No package import; `src/pidge.ts` invokes the `pidge` executable with `execFile(command[0], command.slice(1))`.
  - Default executable: `pidge` from `PATH`; can be overridden with `--pidge`.
  - CLI surface: `rizzfizz handoff --input <dir> --to <agent>`.
  - Auth: Not detected in RizzFizz; any auth or storage is owned by the external Pidge executable.
  - Safety boundary: `src/pidge.ts` validates `--from` and `--to` agent names with `AGENT_NAME_RE`; raw source archive attachment requires explicit `--include-raw`.

**Builder Stack Recommendations:**
- Generated briefs reference frameworks/libraries such as static HTML/CSS/JS, Astro, Next/React/TypeScript/Tailwind, shadcn/ui, Radix, lucide-react, Motion, GSAP, and Three.js in `src/exports.ts`.
  - SDK/Client: Not runtime dependencies of RizzFizz.
  - Auth: Not applicable.
  - Purpose: These names are recommendations emitted into builder-facing artifacts, not imported packages.

## Data Storage

**Databases:**
- Not detected.
  - Connection: Not applicable.
  - Client: Not applicable.

**File Storage:**
- Local filesystem only.
  - `src/io.ts` wraps `readFile`, `writeFile`, and recursive parent-directory creation.
  - `src/scrub.ts` writes run artifacts: `raw-reference.json`, `scrubbed-design-dna.json`, `DESIGN-neutral.md`, `DESIGN-variant-*.md`, `design-md-variation-run.json`, `palette-run.json`, `tokens.css`, `variants-palette.json`, optional `technology-context.json`, and `builder-briefs/*.md`.
  - `src/exports.ts` writes exported a-eyes token JSON, CSS variables, and builder brief Markdown.
  - `src/pidge.ts` writes handoff payloads under `<run-dir>/pidge/payload-*.json`.

**Caching:**
- None detected.

## Authentication & Identity

**Auth Provider:**
- Not detected.
  - Implementation: The CLI has no user accounts, sessions, tokens, OAuth flow, or API keys.
  - Agent identity: `src/pidge.ts` accepts `--from` and `--to` labels for handoff routing and validates them as local agent names, not authenticated principals.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- CLI status and errors use stdout/stderr.
  - `src/cli.ts` prints successful write locations for commands.
  - `src/cli.ts` catches command errors, writes `rizzfizz: <message>` to stderr, and sets `process.exitCode = 1`.
  - External tool stdout is captured for Pidge handoffs in `src/pidge.ts`; Whiffler stdout is parsed as JSON in `src/technology.ts`.

## CI/CD & Deployment

**Hosting:**
- Not detected.
  - RizzFizz is a local Node CLI package with `bin.rizzfizz` mapped to `bin/cli.js`.

**CI Pipeline:**
- None detected in the repo scan.
  - No `.github/workflows` directory is present.
  - Verification commands are npm scripts in `package.json`: `npm run build`, `npm run check`, `npm test`, and `npm run smoke`.

## Environment Configuration

**Required env vars:**
- None detected for runtime.
- `PIDGE_ROOT` appears in `test/cli.test.js` only to isolate Pidge test behavior.

**Secrets location:**
- No root `.env*` files detected.
- No credential, key, or secret files were read.
- Optional external tools may have their own configuration outside this repository; RizzFizz does not manage those secrets.

## Webhooks & Callbacks

**Incoming:**
- None. No HTTP server, webhook route, or callback endpoint is implemented.

**Outgoing:**
- Waffle Whiffler subprocess call for optional URL scans from `src/technology.ts`.
- Pidge subprocess call for optional agent handoffs from `src/pidge.ts`.
- File writes to caller-provided local paths from `src/io.ts`, `src/scrub.ts`, `src/exports.ts`, and `src/pidge.ts`.

## Data Sources

**Design Markdown Inputs:**
- `src/scrub.ts` reads caller-provided Design Markdown files via `--input`.
- Raw text, URLs, colors, font hints, and possible identity terms are preserved privately in `raw-reference.json`; source-safe outputs scrub URLs, emails, clone language, and identity terms.

**Whiffler JSON Inputs:**
- `src/technology.ts` reads existing Whiffler JSON via `readWhifflerScan(path)`.
- `src/cli.ts` exposes this as `rizzfizz tech-scan --input <path>` and `rizzfizz scrub-md --tech-scan <path>`.

**Generated Run Inputs:**
- `src/exports.ts` consumes `palette-run.json` and `scrubbed-design-dna.json` from a RizzFizz run directory for export commands.
- `src/pidge.ts` consumes `palette-run.json` plus optional generated artifacts from a RizzFizz run directory for handoff payloads and attachments.

**Reference/Test Fixtures:**
- `test/fixtures/DESIGN-source.md` provides a scrub input fixture.
- `test/fixtures/waffle-scan.json` provides a Whiffler scan fixture.
- `GitHubPalleteRepos/` and root JSON analysis files are reference/corpus material, not runtime dependencies.

---

*Integration audit: 2026-05-09*
