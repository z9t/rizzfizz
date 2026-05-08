# Technology Stack

**Analysis Date:** 2026-05-09

## Languages

**Primary:**
- TypeScript 5.9.3 - Source implementation under `src/**/*.ts`; compiled with `tsc -p tsconfig.json` from `package.json`.
- JavaScript ESM - Runtime entrypoint `bin/cli.js`, built output `dist/**/*.js`, tests under `test/*.test.js`, and Node guard `scripts/require-node22.mjs`.

**Secondary:**
- Markdown - User-facing docs and fixture input such as `README.md`, `START-HERE.md`, `HANDOFF.md`, and `test/fixtures/DESIGN-source.md`.
- JSON - Generated run artifacts and fixtures such as `test/fixtures/waffle-scan.json`; package metadata in `package.json` and `package-lock.json`.

## Runtime

**Environment:**
- Node.js >=22 required by `package.json` `engines.node`.
- Local pin is Node 22.22.2 in `.nvmrc` and `.node-version`.
- ESM runtime via `"type": "module"` in `package.json` and `module: "NodeNext"` in `tsconfig.json`.

**Package Manager:**
- npm, inferred from `package-lock.json` lockfile v3.
- Lockfile: present at `package-lock.json`.

## Frameworks

**Core:**
- commander 14.0.3 - CLI command routing and option parsing in `src/cli.ts`.
- culori 4.0.2 - OKLCH/OKLab parsing, conversion, interpolation, RGB clamping, and hex formatting in `src/color.ts` through `src/culori-require.ts`.
- Node standard library - Filesystem, path handling, child process execution, module require bridge, and test runner across `src/io.ts`, `src/pidge.ts`, `src/technology.ts`, `src/culori-require.ts`, and `test/*.test.js`.

**Testing:**
- node:test - Built-in test runner used by `test/color.test.js` and `test/cli.test.js`.
- node:assert/strict - Assertions in `test/color.test.js` and `test/cli.test.js`.

**Build/Dev:**
- TypeScript 5.9.3 - Build and check tool configured by `tsconfig.json`; emits declarations and JS to `dist/`.
- npm scripts - `build`, `check`, `test`, and `smoke` are defined in `package.json`.
- Node version guard - `scripts/require-node22.mjs` runs before build/check/test/smoke via npm pre-scripts in `package.json`.

## Key Dependencies

**Critical:**
- `commander` 14.0.3 - Defines the public `rizzfizz` CLI command surface in `src/cli.ts`: `scrub-md`, `tech-scan`, `handoff`, `palette`, `export`, and `css-vars`.
- `culori` 4.0.2 - Core color engine dependency for OKLCH conversion and contrast-safe palette output in `src/color.ts`.

**Infrastructure:**
- `@types/node` 22.19.17 - Type support for Node APIs during TypeScript compilation in `package-lock.json`.
- `typescript` 5.9.3 - Compiler used by `npm run build` and `npm run check` in `package.json`.
- `undici-types` 6.21.0 - Transitive dependency of `@types/node` recorded in `package-lock.json`.

## Configuration

**Environment:**
- No `.env` or `.env.*` files detected at repo depth 3.
- No required application secrets detected in `src/**/*.ts`; `rg` found no `process.env` usage in source.
- `PIDGE_ROOT` appears only in `test/cli.test.js` to isolate the external Pidge bus during integration-style tests.
- Runtime Node version is configured through `.nvmrc`, `.node-version`, `package.json`, and `scripts/require-node22.mjs`.

**Build:**
- `tsconfig.json` uses `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `strict: true`, `rootDir: "src"`, `outDir: "dist"`, and `declaration: true`.
- `package.json` exposes the CLI binary as `rizzfizz` at `bin/cli.js`.
- `bin/cli.js` imports `../dist/cli.js`, so build output must exist before linked CLI use.
- `package.json` `smoke` builds, generates a palette JSON file, and exports a-eyes-compatible token JSON under `/tmp`.

## Platform Requirements

**Development:**
- Run `nvm use` or otherwise provide Node 22.22.2 / Node >=22 before npm scripts; `scripts/require-node22.mjs` exits on older Node majors.
- Run `npm install` with `package-lock.json`, then `npm run build`, `npm run check`, and `npm test`.
- Use `npm link` for global local CLI usage as documented in `README.md`.

**Production:**
- Intended deployment target is a local/CLI Node tool, not a web server.
- `dist/` and `bin/cli.js` are the runtime artifacts; `README.md` documents `node bin/cli.js --help` and linked `rizzfizz` usage.
- Optional local external tools are needed only for specific commands: Whiffler for `tech-scan --url` / `scrub-md --tech-url`, and Pidge for `handoff`.

---

*Stack analysis: 2026-05-09*
