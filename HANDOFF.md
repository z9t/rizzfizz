# RizzFizz Palette And Agent Feed V1 Handoff

## Files Created

- `package.json`
- `tsconfig.json`
- `bin/cli.js`
- `src/`
- `test/`
- `README.md`
- `HANDOFF.md`

## Commands Implemented

- `rizzfizz scrub-md`
- `rizzfizz palette`
- `rizzfizz export --format a-eyes-variant-tokens`
- `rizzfizz export --format agent-brief`
- `rizzfizz export --format css-vars`
- `rizzfizz css-vars`
- `rizzfizz tech-scan`
- `rizzfizz preview`
- `rizzfizz handoff`

## Verification

Run:

```sh
npm install
npm run check
npm test
npm run smoke
```

The canonical preview plus a-eyes intake bridge sample is:

```sh
npm run sample:a-eyes-intake
```

For a disposable output directory, run:

```sh
npm run build
node scripts/run-aeyes-intake-sample.mjs --out /tmp/rizzfizz-aeyes-intake-sample
```

The sample runner executes:

```sh
node bin/cli.js scrub-md --input test/fixtures/a-eyes-intake/DESIGN.md --variants 3 --relationship gallery-neutral --hue green --out runs/a-eyes-intake-sample
node bin/cli.js preview --input runs/a-eyes-intake-sample --out runs/a-eyes-intake-sample/preview.html
node bin/cli.js export --format a-eyes-intake-variants --input runs/a-eyes-intake-sample --out runs/a-eyes-intake-sample/variants.json
node bin/cli.js handoff --input runs/a-eyes-intake-sample --to a-eyes --from codex --kind rizzfizz-a-eyes-intake --variant all --dry-run
```

This produces `preview.html`, regenerated `variants.json`, and a dry-run `pidge/payload-*-a-eyes.json` without sending through Pidge.

RizzFizz should not add legacy a-eyes input files as canonical output. Do not write `brief.raw.txt` or `brief.structured.json` by default from `scrub-md`, `import-brief-weaver`, or sample runners. The current intended mapping is documented in `A-EYES-INTEGRATION-BOUNDARY.md`: `variants.json` becomes variant lane packets, `build-contract.json` becomes the shared builder contract, `builder-briefs/variant-*.md` becomes per-variant builder prompts, `preview.html` becomes the review/selection artifact, and the Pidge payload is a workbench feed packet candidate.

## Notes

This project is independent from `a-eyes`. It can emit a-eyes-compatible palette token payloads, but it does not modify any a-eyes workstream.

`rizzfizz preview --input <run> --out <html>` is the human selection bridge for the current a-eyes flow: generate a source-safe run, open the static preview, choose a variant, then pass the matching `variants-palette.json` item and `builder-briefs/variant-*.md` into builder execution. The preview uses only source-safe run artifacts and does not expose `raw-reference.json`.

Waffle Whiffler integration is intentionally thin. `rizzfizz tech-scan` can run `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js --json <url>` or summarize an existing Whiffler JSON file, then writes `technology-context.json` for source-safe builder briefs. The RizzFizz artifact redacts the scanned URL, does not carry the raw Whiffler scan forward, and preserves only compact confidence/evidence summaries, weak signals, stack-fit cautions, and explicit `do_not_clone` notes for `variants.json` and `preview.html`.

Pidge integration is also thin and uses the installed `pidge` tool on PATH. `rizzfizz handoff` writes a JSON payload under `<run>/pidge/`, attaches source-safe generated artifacts, and calls `pidge send`. Use `--dry-run` to inspect the command. `raw-reference.json` is excluded unless `--include-raw` is set.
