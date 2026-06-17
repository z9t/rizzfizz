# Mid-flight QA addendum: rizzfizz

Purpose: patch the current SOOP plan while work is already in flight. This does not replace the staged plans; it adds missing gates that should be enforced before closing any stage.

## Current status
npm test passes, but dirty tree and integration boundaries need canonical gates.

## Universal gates to add to this project
- Add or name one canonical local check entrypoint (`qa.sh`, `check.sh`, `npm run validate`, `swift test`, or equivalent). Stage 00 cannot close on scattered commands.
- Record repo boundary and dirty-state policy: own repo vs parent `/Users/max`, ignored runtime artifacts, and whether generated eval/plans files are intended to be committed.
- Add machine-readable command spec for every gate: command, cwd, env, timeout, expected exit code, side-effect policy, and artifact paths.
- Add clean-shell reproduction evidence after each fix: exact command, exit code, environment note, and CONFIRMED/FIXED/RETEST verdict.
- Block live network, paid provider, browser/system config, or filesystem-destructive checks unless explicitly budgeted/gated and isolated in temp roots.
- Add schema/golden checks for generated artifacts and handoff packets; string-presence tests are not enough.
- Add redaction/leak check for artifacts: no API keys, tokens, absolute private source paths where avoidable, raw binary, or oversized terminal output.
- Add flake/resource gate for blocker fixes: repeat the fixed command at least 3 times, and run under constrained resources when the original bug involved FD/thread/process exhaustion.

## Project-specific additions
- Add CLI negative cases: bad variants, invalid hex, unsupported export, malformed Whiffler JSON, missing Brief Weaver contract.
- Add golden outputs for generated design/artifact bundles with deterministic seed/run-id.
- Dirty-tree policy must separate intentional generated artifacts from WIP before release gates are trusted.

## Canonical commands / checks to record
- `npm test`
- `<new> npm run check`
- `<new> npm run smoke`

## Workforce / reviewer needs
- Need frontend/CLI reviewer.
- Need Brief-Weaver/Whiffler contract reviewer for roundtrip tests.

## Closeout rule
No stage is complete until a clean-shell qa-eval rerun records command, exit code, stdout/stderr summary, and changed files. If a finding is waived, the waiver must name the owner, scope, expiry, and compensating check.
