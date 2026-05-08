# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**Local CLI Integrations:**
- Waffle Whiffler - Technology fingerprint source for `rizzfizz tech-scan` and optional `scrub-md` technology context.
  - SDK/Client: no npm SDK; `src/technology.ts` executes `node /Users/max/Documents/Code/whiffler/src/cli/whiffler.js --json <url>` with `execFile`.
  - Auth: Not detected.
  - Inputs: URL via `--url` or existing Whiffler JSON via `--input` / `--tech-scan` in `src/cli.ts`.
  - Output: `technology-context.json` with schema `rizzfizz.technology-context.v1` from `src/technology.ts`.
- Pidge - Local agent handoff transport for completed RizzFizz runs.
  - SDK/Client: no npm SDK; `src/pidge.ts` executes `pidge send` or a user-provided `--pidge <path>` with `execFile`.
  - Auth: Not detected.
  - Inputs: generated run directory with `palette-run.json`, `scrubbed-design-dna.json`, `variants-palette.json`, optional `technology-context.json`, and variant files in `src/pidge.ts`.
  - Output: handoff payload under `<run>/pidge/payload-*.json` plus `pidge send` message.

**Generated Consumer Formats:**
- a-eyes - Downstream-compatible palette token payload, but not a runtime dependency.
  - SDK/Client: none; `src/exports.ts` writes schema `rizzfizz.a-eyes-variant-tokens.v1`.
  - Auth: Not detected.
  - Boundary: `HANDOFF.md` states this project can emit a-eyes-compatible payloads but does not modify any a-eyes workstream.

**Network Scanning:**
- Target websites - Optional Whiffler scans use user-supplied URLs from `src/cli.ts` `--url` / `--tech-url`.
  - SDK/Client: delegated to Whiffler through `src/technology.ts`.
  - Auth: Not detected.

## Data Storage

**Databases:**
- Not detected.
  - Connection: Not applicable.
  - Client: Not applicable.

**File Storage:**
- Local filesystem only.
- `src/io.ts` provides `readText`, `writeText`, `readJson`, and `writeJson` using `node:fs/promises`.
- `scrub-md` writes run artifacts under the user-provided `--out` directory in `src/scrub.ts`.
- `export` writes derived JSON, CSS, or Markdown outputs to user-provided paths in `src/exports.ts`.
- `handoff` writes Pidge payload JSON under `<run>/pidge/` in `src/pidge.ts`.

**Caching:**
- None detected.

## Authentication & Identity

**Auth Provider:**
- Not detected.
  - Implementation: No app login, OAuth, API key, or session management detected in `src/**/*.ts`.

**Identity Handling:**
- Source identity scrubbing is a core data-safety feature, not authentication.
- `src/scrub.ts` extracts URLs, emails, hex colors, font hints, and possible identity terms into `raw-reference.json`, then removes or replaces source identifiers for builder-facing outputs.
- `raw-reference.json` is private source archive data and is excluded from Pidge attachments unless `--include-raw` is explicitly set in `src/cli.ts` and `src/pidge.ts`.

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- CLI status and errors through `console.log`, `console.error`, and `process.exitCode` in `src/cli.ts`.
- External command stdout is captured and returned from Pidge sends in `src/pidge.ts`.
- Whiffler stdout is parsed as JSON in `src/technology.ts`; no structured runtime logging layer is present.

## CI/CD & Deployment

**Hosting:**
- Not detected.
- The project is a local Node CLI with binary entrypoint `bin/cli.js` and compiled output in `dist/`.

**CI Pipeline:**
- None detected in repository files scanned.
- Local verification commands are defined in `package.json`: `npm run build`, `npm run check`, `npm test`, and `npm run smoke`.

## Environment Configuration

**Required env vars:**
- None detected for application runtime.
- `PIDGE_ROOT` is used only in `test/cli.test.js` to isolate real Pidge integration tests.

**Secrets location:**
- Not detected.
- No `.env` or `.env.*` files detected at repo depth 3.
- Do not add secrets to generated run artifacts; `raw-reference.json` can contain private source text by design and should stay out of builder-facing handoffs unless explicitly required.

## Webhooks & Callbacks

**Incoming:**
- None detected.
- There is no HTTP server, webhook route, or callback listener in `src/**/*.ts`.

**Outgoing:**
- No direct HTTP client calls detected in source.
- Outgoing network behavior can occur indirectly when Whiffler scans a user-provided URL through `src/technology.ts`.
- Local outgoing agent-bus messages are sent with `pidge send` from `src/pidge.ts`.

---

*Integration audit: 2026-05-09*
