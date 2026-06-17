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
