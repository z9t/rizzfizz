# stage-03-integration-contracts plan for rizzfizz

Goal: Prove cross-product contracts: Pidge handoffs, RizzFizz/Brief-Weaver/Whiffler roundtrips, provider mocks, and side-effect firewalls.

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

Future-phase placeholders:

- Defer exact tasks until previous stage handoffs exist.
- Keep one-variable-at-a-time gates: do not combine feature expansion with safety fixes.
- Before actioning this stage, rewrite this placeholder using the latest verification outputs and current product direction.

Deadline guideline after Kanban approval: schedule only after all parent stages are green or explicitly accepted with documented risk.
