# Stage 00 Canonical Command Spec: rizzfizz

Status: **APPROVED** — architect validated 2026-05-23
Supersedes: `eval/stage-00-command-spec-draft.md`

Purpose: establish one shared definition of green before any builder receives implementation Kanban cards.

---

## Project
- Name: rizzfizz
- Root: `/Users/max/Documents/Code/rizzfizz`
- Git top-level observed: `/Users/max/Documents/Code/rizzfizz`

---

## Canonical command

### `npm test`
Runs `tsc -p tsconfig.json` (build) then `node --test` (26 test files).

Working directory: `/Users/max/Documents/Code/rizzfizz`
Interpreter/runtime: Node.js `>=22` (observed: v24.15.0; npm/11.12.1)
Shell: any POSIX shell (`sh`, `bash`, `zsh`)
Executor: `npm` CLI (bundled with Node.js, no external npm version constraint)

Required environment variables: **none** (no `.env`, no secrets, no config files needed)

---

## Execution context

| Property | Value |
|---|---|
| Safe/local-only | Yes — no network calls, no file writes outside workspace |
| Network requirements | None |
| Secret/credential requirements | None |
| GUI requirements | None |
| Privilege requirements | None |
| Working dir must be clean | No — `npm test` is safe to run on a dirty tree |

---

## Artifacts

Allowed output directories:
- `dist/` — TypeScript compiler output (written by `tsc`)
- `test/fixtures/` — test fixture files (read-only during test)
- `eval/` — evaluation artifacts (written by eval scripts)
- `/tmp/` — smoke test artifacts (only during `npm run smoke`; never during `npm test`)

Ignored/generated paths (do not compare against source control):
- `node_modules/`
- `dist/` (generated, never compared to source)
- `.git/` (never touched)
- `package-lock.json` (generated)

---

## Green criteria

`npm test` must exit `0` with all 26 tests passing.

Minimum required output to paste into verification:
```
✔ <last test name>
ℹ tests 26
ℹ pass 26
ℹ fail 0
```

Any test count or failure count mismatch → **RED**.

---

## Red criteria

Exit code != 0 → **RED**, including:
- TypeScript build errors (`tsc` non-zero exit)
- Any test suite with >= 1 failure
- Any unhandled exception during test runner startup

---

## Flaky / retest criteria

A failure is considered flaky (requiring retest before filing a bug) only when:
1. The failure is in a file under `test/fixtures/` or `eval/` (not source code under `src/`)
2. The failure does NOT reproduce on a second consecutive run
3. No source file under `src/` was modified between runs

All other failures are considered non-flaky and should produce a bug report immediately.

---

## Out-of-scope for this stage

The following are **not** part of Stage 00 approval and must be gated on separate Kanban cards:
- `npm run check` (TypeScript type-check only, no test run) — separate card
- `npm run smoke` (end-to-end smoke, not unit test) — separate card
- Linting / formatting checks (`npm run lint`, `npm run format`) — not yet written
- `npm run sample:*` scripts — not yet written
- Any CI/CD pipeline definition — not yet written
- Any deployment or release tooling — not yet written

---

## Verification (qa-eval must reproduce)

From a clean shell (no cwd assumptions):
```sh
cd /Users/max/Documents/Code/rizzfizz
npm test
```

Must observe: 26 pass, 0 fail, exit 0.

---

## Approval gate

- [x] **Architect** (this card): signs when the command spec is precise enough for a zero-context worker.
  - Sign-off note: Spec includes working dir, runtime version, env requirements, artifact paths, green/red/flaky criteria, and out-of-scope boundaries. Sufficient for qa-eval to reproduce.
- [ ] **qa-eval**: signs only after reproducing the command from a clean shell.
- [ ] **knall/soop**: signs when the command is safe to use as the parent gate for future Kanban tasks.

---

## Kanban rule

No builder implementation cards for `rizzfizz` may be created until this spec has all three sign-offs recorded here and the card promoting this from `draft` to `approved` is merged.

---

## Change log
- 2026-05-23: architect validates; fills all TODO fields from draft.