# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**
- TypeScript - Source code lives under `src/**/*.ts`; `tsconfig.json` compiles from `src` to `dist` with `strict` mode and declaration output.
- JavaScript - Runtime entrypoint and tests use ESM JavaScript in `bin/cli.js`, `scripts/require-node22.mjs`, and `test/*.test.js`.

**Secondary:**
- Markdown - Product handoff and prompt/reference documentation live in `README.md`, `START-HERE.md`, `HANDOFF.md`, `HIGH-END-AI-WEBSITE-STACK-2026-05.md`, and `PROMPT-palette-engine-mvp.md`.
- JSON - Generated/reference artifacts include `color-analysis-output.json`, `color_repo_analysis.json`, and test fixtures such as `test/fixtures/waffle-scan.json`.

## Runtime

**Environment:**
- Node.js >=22 is required by `package.json` `engines.node` and enforced before build/check/test/smoke by `scripts/require-node22.mjs`.
- Local Node version pins are `22.22.2` in `.nvmrc` and `.node-version`.
- The package is ESM-first via `"type": "module"` in `package.json`.

**Package Manager:**
- npm, using `package-lock.json` lockfile version 3.
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**
- Commander `^14.0.2` - CLI command registration and option parsing in `src/cli.ts`.
- Culori `^4.0.2` - OKLCH/OKLab parsing, conversion, RGB clamping, and hex formatting through `src/color.ts` and the CommonJS bridge in `src/culori-require.ts`.
- Node built-ins - `node:fs/promises`, `node:path`, `node:child_process`, `node:util`, and `node:module` are used for local IO, subprocess integrations, and CommonJS interop.

**Testing:**
- Node test runner - `npm test` builds with TypeScript and runs `node --test`; tests are in `test/color.test.js` and `test/cli.test.js`.
- Node assert - Assertions use `node:assert/strict` in `test/*.test.js`.

**Build/Dev:**
- TypeScript `^5.9.3` - `npm run build` executes `tsc -p tsconfig.json`; `npm run check` runs the same project with `--noEmit`.
- `@types/node` `^22.19.1` - Node type declarations for development.
- npm scripts in `package.json` gate `build`, `check`, `test`, and `smoke` with the Node 22 preflight script.

## Key Dependencies

**Critical:**
- `commander` `^14.0.2` - Owns the `rizzfizz` CLI command surface in `src/cli.ts`, including `scrub-md`, `tech-scan`, `handoff`, `palette`, `export`, and `css-vars`.
- `culori` `^4.0.2` - Owns the color engine's OKLCH conversion path in `src/color.ts`; failures here affect palette generation, contrast checks, token output, and exported briefs.

**Infrastructure:**
- `typescript` `^5.9.3` - Produces distributable JavaScript in `dist` from `src`.
- `@types/node` `^22.19.1` - Provides compile-time Node API coverage.
- Waffle Whiffler external CLI - Invoked by `src/technology.ts` through `node /Users/max/Documents/Code/whiffler/src/cli/whiffler.js --json <url>` unless overridden.
- Pidge external CLI - Invoked by `src/pidge.ts` as `pidge send ...` unless overridden by `--pidge`.

## Configuration

**Environment:**
- No `.env*` files are present at the repo root.
- Runtime configuration is primarily CLI flags handled in `src/cli.ts`.
- `PIDGE_ROOT` is only used by tests when invoking external Pidge behavior in `test/cli.test.js`; production code delegates Pidge storage behavior to the `pidge` executable.
- Required local tools for optional integrations: Whiffler at `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js` for default technology scans, and `pidge` on `PATH` for non-dry-run handoffs.

**Build:**
- `package.json` defines scripts, dependencies, binary mapping, and Node engine requirements.
- `tsconfig.json` uses `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `rootDir: src`, `outDir: dist`, and `declaration: true`.
- `bin/cli.js` is a checked-in executable shim that imports `../dist/cli.js`; build output must exist before invoking the package binary.
- No ESLint, Prettier, Jest, Vitest, Vite, Next, or bundler config files are detected at the repo root.

## Platform Requirements

**Development:**
- Run `nvm use` or equivalent to select Node `22.22.2`, then `npm install`.
- Run `npm run build` before executing `node bin/cli.js` or linked `rizzfizz` because the bin shim loads `dist/cli.js`.
- Use `npm run check` for type-only verification and `npm test` for build plus Node test runner coverage.
- Use `npm run smoke` to verify palette generation and a-eyes token export through the built CLI.

**Production:**
- Deployment target is a local/linked Node CLI package, not a web server.
- The published/linked executable is `rizzfizz` from `bin/cli.js`.
- Optional production capabilities depend on local external executables: Whiffler for `tech-scan --url` and Pidge for `handoff` without `--dry-run`.
- Persistent output is filesystem-based under caller-provided paths such as run directories and exported JSON/CSS/Markdown files.

---

*Stack analysis: 2026-05-09*
