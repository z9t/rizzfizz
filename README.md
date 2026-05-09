# RizzFizz

RizzFizz is a CLI-first design intelligence for website-builder agents.

`rizzfizz` turns private Design Markdown references into scrubbed design DNA, OKLCH palette variants, CSS tokens, and constrained builder briefs. It preserves raw provenance separately from source-safe outputs so downstream agents can build from abstract design relationships without receiving clone instructions or source identity.

## Install

```sh
npm install
npm run build
npm link
```

The executable is also runnable before linking:

```sh
node bin/cli.js --help
```

## Commands

```sh
rizzfizz scrub-md --input ./DESIGN-source.md --variants 4 --out ./runs/example
rizzfizz palette --relationship dark-sparse-accent --hue blue --variants 4 --out ./palette-run.json
rizzfizz export --format a-eyes-variant-tokens --input ./palette-run.json --out ./variants-palette.json
rizzfizz export --format agent-brief --input ./runs/example --out ./runs/example/builder-briefs
rizzfizz export --format css-vars --input ./palette-run.json --out ./tokens.css
rizzfizz tech-scan --url https://example.com --out ./technology-context.json
rizzfizz tech-scan --input ./whiffler-scan.json --out ./technology-context.json
rizzfizz inspect --input ./runs/example
rizzfizz handoff --input ./runs/example --to gemma --variant variant-1 --expects-response
```

## Output Shape

`scrub-md` writes:

- `raw-reference.json`: private source archive with raw text, URLs, colors, font hints, and identity terms.
- `scrubbed-design-dna.json`: source-safe design system, design style, and visual effects guidance.
- `build-contract.json`: source-safe implementation contract for agents, including page intent, layout regions, components, motion rules, visual QA, and per-variant visual rules.
- `visual-tokens.json`: expanded semantic tokens for surfaces, text, actions, status colors, data visualization, and effects.
- `run-manifest.json`: compact source-safe entrypoint that points humans and agents to the generated artifacts.
- `DESIGN-neutral.md` and `DESIGN-variant-*.md`: source-safe design Markdown files.
- `palette-run.json`: OKLCH-generated variants with WCAG contrast checks.
- `tokens.css`: CSS custom properties for the first palette variant.
- `variants-palette.json`: a-eyes-compatible variant token payload.
- `builder-briefs/variant-*.md`: constrained web-coding agent briefs.
- `technology-context.json`: optional Whiffler-derived technology evidence and source-safe stack recommendations.

## Color Engine

Palette generation uses OKLCH/OKLab through `culori`, then emits sRGB-safe hex values. V1 supports relationship presets:

- `dark-sparse-accent`
- `light-editorial-accent`
- `gallery-neutral`
- `product-clear`
- `immersive-chroma`

Required tokens:

```json
{
  "paper": "#000000",
  "panel": "#000000",
  "ink": "#FFFFFF",
  "muted": "#AAAAAA",
  "accent": "#68B7FF",
  "accent_strong": "#3F8FE5",
  "line": "#333333"
}
```

Hard failures:

- `ink` on `paper` below 4.5:1.
- `ink` on `panel` below 4.5:1.

Warnings:

- `muted` on `paper` below 3.0:1.
- `accent` on `paper` or `panel` below 3.0:1.

## Builder Guidance

Generated briefs tell builders to create the actual usable experience, use semantic HTML, preserve source-safe abstract design traits, respect reduced motion, and verify desktop/mobile layout with Playwright screenshots before finishing.

## Waffle Whiffler Technology Feed

`rizzfizz` can consume `/Users/max/Documents/Code/whiffler` without importing its internals:

```sh
rizzfizz tech-scan --url https://example.com --out ./technology-context.json
rizzfizz scrub-md --input ./DESIGN-source.md --tech-scan ./whiffler-scan.json --variants 4 --out ./runs/example
rizzfizz scrub-md --input ./DESIGN-source.md --tech-url https://example.com --variants 4 --out ./runs/example
```

The technology context preserves Whiffler evidence separately from builder-facing recommendations. Detected source technologies are treated as reference context, not as a requirement to clone the source stack.

## Pidge Handoffs

Generated runs can be handed to another local agent through the named `pidge` tool:

```sh
rizzfizz handoff \
  --input ./runs/example \
  --from codex \
  --to gemma \
  --kind rizzfizz-handoff \
  --variant variant-1 \
  --expects-response
```

Use `--dry-run` to write the payload and print the exact `pidge send` command without sending it:

```sh
rizzfizz handoff --input ./runs/example --to gemma --variant all --dry-run
```

Default attachments are source-safe:

- `scrubbed-design-dna.json`
- `build-contract.json`
- `visual-tokens.json`
- `run-manifest.json`
- `palette-run.json`
- `variants-palette.json`
- `tokens.css`
- `technology-context.json`, when present
- selected `DESIGN-variant-*.md`
- selected `builder-briefs/variant-*.md`

`raw-reference.json` is not attached unless `--include-raw` is explicitly set.

## Limitations

V1 uses deterministic text heuristics for scrubbing and design DNA extraction. It does not yet ingest screenshots, run browser extraction, call an LLM, export W3C Design Tokens, or create an interactive palette editor.
