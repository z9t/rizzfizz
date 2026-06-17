# stage-00-triage-and-gates plan for rizzfizz

Goal: produce an approved canonical command spec before any implementation work.


## Stage 00 Kanban lock

Do not convert this plan into builder/implementation Kanban tasks yet.

Stage 00 must first produce an approved canonical command spec for this project. The spec must say:
- exact command(s), working directory, shell, interpreter/runtime version, and environment variables
- what counts as green, red, flaky/retest, skipped, or intentionally out of scope
- which generated/runtime artifacts are allowed and where they may be written
- whether the command is safe/local-only or requires secrets, network, GUI, or privileged writes
- who signs off: architect defines, qa-eval reproduces, knall/soop approves promotion

Only after that exists should builder receive implementation cards. Otherwise builders will scatter into local “fixes” with different definitions of green.


Current draft command(s):
- `npm test`

Second-lap status: GREEN on current draft smoke/check command, but not Stage-00 approved until command spec includes scope, env, artifacts, and qa-eval reproduction.

Required Stage 00 outputs:
1. Complete `eval/stage-00-command-spec-draft.md` with exact environment, command, artifact, and green/red criteria.
2. qa-eval reruns the command from a clean shell and writes evidence to `eval/second-lap-verification.md` or a new dated verification file.
3. knall/soop classifies the spec as APPROVED, RETEST, or REJECTED.
4. Only if APPROVED, create downstream builder cards for Stage 01.

Role prompts:
- Architect: define the command spec; success is an unambiguous spec a zero-context worker can run.
- qa-eval: reproduce the command spec exactly; success is exit codes and log evidence attached.
- knall: compare spec and evidence; success is a go/no-go verdict for Stage 01.
- Builder: no assignment in this stage unless only documentation of command scripts is explicitly approved.

Previous placeholder content retained below for context:

---

# stage-00-triage-and-gates plan for rizzfizz

Goal: Stabilize the ground: verify QA findings, define canonical check commands, isolate repo/runtime noise, and block release on known red gates.

Project-specific focus:
- canonical check/smoke scripts
- freeze output schemas
- hostile source-leak corpus
- Pidge handoff contract
- release-scope decision for extension/bookmarklet/gallery

Suggested owners:
- Architect: stage design, acceptance criteria, dependency ordering.
- Builder: implementation once a test or gate is specified.
- qa-eval: independent reproduction and verification.
- knall: integrate verification reports into go/no-go recommendations.
- Designer: product/UX checks where this stage touches UI, workflows, docs, or error states.
- Research/seek: external provider, platform, or API behavior research when needed.

Near-term task prompts:

1. Architect prompt: In `/Users/max/Documents/Code/rizzfizz`, inspect the current QA finding and define the minimum gate for this stage. Success: a one-page acceptance checklist with exact commands and no implementation.
2. Builder prompt: Implement only the smallest change needed for the first failing gate after Architect’s checklist exists. Success: failing regression added first, then green local command.
3. qa-eval prompt: Reproduce the original failure and the new green path from a clean shell. Success: report includes command, exit code, environment, and whether the finding is CONFIRMED/FIXED/RETEST.
4. knall prompt: Compare builder and qa-eval handoffs. Success: approve move to next stage, reject with reasons, or request one-variable retest.

Deadline guideline after Kanban approval: Stage 00 within 24 hours for blocker projects; Stage 01 within 48-72 hours for projects with active release pressure.

