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
- `rizzfizz handoff`

## Verification

Run:

```sh
npm install
npm run check
npm test
npm run smoke
```

## Notes

This project is independent from `a-eyes`. It can emit a-eyes-compatible palette token payloads, but it does not modify any a-eyes workstream.

Waffle Whiffler integration is intentionally thin. `rizzfizz tech-scan` can run `/Users/max/Documents/Code/whiffler/src/cli/whiffler.js --json <url>` or summarize an existing Whiffler JSON file, then writes `technology-context.json` for source-safe builder briefs.

Pidge integration is also thin and uses the installed `pidge` tool on PATH. `rizzfizz handoff` writes a JSON payload under `<run>/pidge/`, attaches source-safe generated artifacts, and calls `pidge send`. Use `--dry-run` to inspect the command. `raw-reference.json` is excluded unless `--include-raw` is set.
