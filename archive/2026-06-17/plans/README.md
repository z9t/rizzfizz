# Plans for rizzfizz

This folder breaks the path from current QA findings to a good product into staged work. Do not start Kanban cards from this automatically; use it as the planning substrate once the board strategy is approved.

Stage order:
- `stage-00-triage-and-gates`: Stabilize the ground: verify QA findings, define canonical check commands, isolate repo/runtime noise, and block release on known red gates.
- `stage-01-blocker-fixes`: Address immediate release blockers only, with regression tests first and no feature expansion.
- `stage-02-test-harness-and-schemas`: Build the repeatable validation surface: schemas, fixtures, fuzz/golden suites, and leak scanners.
- `stage-03-integration-contracts`: Prove cross-product contracts: Pidge handoffs, RizzFizz/Brief-Weaver/Whiffler roundtrips, provider mocks, and side-effect firewalls.
- `stage-04-product-hardening`: Turn viable tools into good products: UX, docs, dry-run safety, install/upgrade flows, observability, and explicit failure states.
- `stage-05-release-and-operations`: Run pre-release, nightly, and post-release gates: matrices, flaky repeaters, live smokes, release notes, and maintenance ownership.

## Global Kanban lock

No builder/implementation Kanban tasks may be created from these plans until `eval/stage-00-command-spec-draft.md` is approved as this project's canonical command spec. Stage 00 may create only planning/verification/specification tasks for architect, qa-eval, and knall/soop.

