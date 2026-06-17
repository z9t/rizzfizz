# STAGE 00 FIRST — CANONICAL COMMAND SPEC REQUIRED

Do not implement fixes. Do not create builder Kanban cards. First produce and approve `eval/stage-00-command-spec-draft.md` as the canonical command spec for this project.


## Stage 00 Kanban lock

Do not convert this plan into builder/implementation Kanban tasks yet.

Stage 00 must first produce an approved canonical command spec for this project. The spec must say:
- exact command(s), working directory, shell, interpreter/runtime version, and environment variables
- what counts as green, red, flaky/retest, skipped, or intentionally out of scope
- which generated/runtime artifacts are allowed and where they may be written
- whether the command is safe/local-only or requires secrets, network, GUI, or privileged writes
- who signs off: architect defines, qa-eval reproduces, knall/soop approves promotion

Only after that exists should builder receive implementation cards. Otherwise builders will scatter into local “fixes” with different definitions of green.


---

# Next-Phase Execution Prompt: rizzfizz

You are the owner agent for `rizzfizz`. Do not expand product scope until Stage 00 and Stage 01 gates are green.

Context:
# QA Eval Section: rizzfizz

Current place:
- Node/TS CLI for source-safe design DNA, palettes, exports, Whiffler tech context, Brief Weaver import, Pidge handoff.
- npm test passes 26 tests.
- Working tree dirty with new/untracked extension/bookmarklet/gallery scripts not necessarily in QA scope.

Add tests:
- Source-safety red team: brand names, URLs, CSS/JS snippets, tracking IDs, image metadata, font names; public artifacts exclude source identity and clone language.
- Artifact schemas: scrubbed DNA, build contract, visual tokens, run manifest, variants, preview, briefs.
- CLI negative cases: bad variants, invalid hex, unsupported export, malformed Whiffler JSON, missing Brief Weaver contract.
- Handoff: dry-run never sends; include-raw default false; shell quoting paths/names with spaces/metacharacters; variant all vs N attachment sets.
- Tech scan: weak evidence not promoted; malicious evidence redacted/bounded.
- Palette matrix: relationships x hue families x variant counts; contrast cannot regress.
- design-md: output complies with expected DESIGN.md sections and remains source-safe.

Milestones:
- M0: require npm run check, npm test, npm run smoke.
- M1: freeze output schemas.
- M2: hostile source-leak corpus.
- M3: Pidge handoff contract.
- M4: explicitly include or exclude bookmarklet/extension/gallery pipeline from release QA.

Verified status:
CONFIRMED: standalone repo. Re-run `npm test`: 26 passed. Git status shows many modified/untracked files, matching dirty-tree concern.

Mission for next phase:
1. Start with the nearest red gate, not the most interesting feature.
2. Write regression tests before implementation.
3. Keep generated/runtime artifacts out of source control.
4. Produce a short handoff containing commands run, files changed, remaining blockers, and whether qa-eval can independently reproduce green status.
5. Do not use live credentials, live destructive writes, AppleScript app-opening, privileged helper installation, or external provider calls unless the task explicitly says the gate is live/secret-approved.

Available profiles discovered: animator, architect, builder, designer, knowall, research, seek, qa-eval, knall. Recommended routing: architect for architecture/gate design; builder for implementation; designer for product/UI; research or seek for external/API/domain research; qa-eval for independent verification; knall for synthesis of QA reports; knowall for durable knowledge/docs synthesis. Missing specialist to consider adding later: dedicated macOS/security engineer for privileged helper and notarization work; load/performance engineer for high-concurrency proxy/server testing.

Recommended first allocation for this project:
- Architect: confirm the check command and acceptance gate shape.
- Builder: implement the smallest blocker fix or test harness change.
- qa-eval: re-run the exact repro and verify the fix in a clean shell.
- knall: synthesize whether the project can move from blocker remediation to harness expansion.
- Designer: join only for product/UI-facing Stage 04 work unless the project has immediate UI safety copy/error-state gaps.

Success criteria for next phase:
- The top red finding for `rizzfizz` is either fixed and independently verified, or explicitly reclassified with evidence.
- A canonical local check command exists or is documented.
- Any new test is included in the default validation path.
- Handoff includes exact command output and remaining risks.
