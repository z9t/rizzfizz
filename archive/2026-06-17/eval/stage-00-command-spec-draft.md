# Stage 00 Canonical Command Spec Draft: rizzfizz

Status: DRAFT — not canonical until architect + qa-eval + soop/knall approval.

Purpose: establish one shared definition of green before any builder receives implementation Kanban cards.

## Project
- Name: rizzfizz
- Root: `/Users/max/Documents/Code/rizzfizz`
- Git top-level observed: `/Users/max/Documents/Code/rizzfizz`

## Draft local command set
- `npm test`

## Required fields before approval
- Working directory for each command: TODO
- Shell/runtime/interpreter version: TODO
- Required environment variables: TODO
- Safe/local-only status: TODO
- Network/secret/GUI/privilege requirements: TODO
- Expected generated artifacts and allowed output dirs: TODO
- Known ignored/generated paths: TODO
- Green criteria: TODO
- Red criteria: TODO
- Flaky/retest criteria: TODO
- Out-of-scope checks for this stage: TODO
- Minimum log/output that qa-eval must paste into verification: TODO

## Current second-lap evidence
See `eval/second-lap-verification.md`.

## Approval gate
- Architect signs when the command spec is precise enough for a zero-context worker.
- qa-eval signs only after reproducing the command from a clean shell.
- knall/soop signs when the command is safe to use as the parent gate for future Kanban tasks.

## Kanban rule
No builder implementation cards for `rizzfizz` until this draft is replaced or amended with an APPROVED status and sign-off notes.
