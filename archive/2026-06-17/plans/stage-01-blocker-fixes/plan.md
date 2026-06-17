# stage-01-blocker-fixes plan for rizzfizz

Goal: Address immediate release blockers only, with regression tests first and no feature expansion.

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
