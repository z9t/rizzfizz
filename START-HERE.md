# RizzFizz: Palette And Reference Ingestion

Status: starter brief
Date: 2026-05-06

## Goal

Build a small design-intelligence utility for ingesting design references, extracting color/style signals, scrubbing identifying information, and producing high-quality alternate palette/design briefs for website builders.

This should be independent infrastructure, not buried inside `a-eyes`.

`a-eyes` can use it later, but the tool should also work for other website/design workflows.

## Core Idea

```text
raw references -> private source archive -> scrubbed design DNA -> palette variants -> builder-ready tokens/briefs
```

Inputs may include:

- URLs
- screenshots
- design Markdown files
- notes about sites we like
- generated website outputs
- palette seed files

Design Markdown files are a primary input type. Example source files may look like:

```text
~/.design/DESIGN-ifp.md
~/.design/DESIGN-some-site.md
```

These may contain source URLs, brand names, platform details, exact colour values, fonts, component notes, and copyable design-system summaries. `rizzfizz` should preserve the design intelligence but produce builder-facing outputs that are scrubbed and varied.

Outputs should avoid direct copying:

- no brand names in builder-facing briefs
- no exact “recreate this site” instructions
- no signature imagery or distinctive phrasing
- preserve abstract design traits, palette relationships, spacing/motion notes, and interaction feel

## Recommended Shape

Start with a CLI, then wrap it with an API later.

CLI first:

```sh
rizzfizz ingest ./references/site.md
rizzfizz extract --image screenshot.png
rizzfizz scrub-md ~/.design/DESIGN-ifp.md --variants 5
rizzfizz scrub --input raw-reference.json
rizzfizz palette --brief scrubbed-design-dna.json --variants 6
rizzfizz export --format css-vars --input palette-run.json
rizzfizz import-brief-weaver --input /Users/max/Documents/Code/brief-weaver/brief-weaver-runs/<run_id> --out ./runs/<run_id>
```

## Current Brief Weaver Bridge

Use the bridge when Brief Weaver has already produced `brief-weaver-runs/<run_id>/` and you want a normal RizzFizz run folder:

```sh
cd /Users/max/Documents/Code/rizzfizz
npm install
npm run build
node bin/cli.js import-brief-weaver \
  --input /Users/max/Documents/Code/brief-weaver/brief-weaver-runs/<run_id> \
  --out ./runs/<run_id>
```

The bridge maps Brief Weaver's source-safe `scrubbed/`, `variants/`, `palettes/`, and `variation-manifest.json` files into RizzFizz's `run-manifest.json`, `palette-run.json`, `variants-palette.json`, `variants.json`, `builder-briefs/`, and `preview.html`. It does not copy Brief Weaver `raw/` contents into builder-facing artifacts; private provenance stays in `raw-reference.json`.

Possible local API later:

```text
POST /v1/ingest
POST /v1/extract
POST /v1/scrub-md
POST /v1/scrub
POST /v1/palettes
POST /v1/export
```

## Influence Repos

These are influences and technology candidates, not committed dependencies.

### Color extraction

- https://github.com/lokesh/color-thief

Useful because it is mature and directly relevant for extracting dominant colors and palettes from images in browser/Node. Its README describes dominant color extraction, palette extraction, semantic swatches, OKLCH quantization, WCAG contrast helpers, and CLI output.

Likely role:

```text
screenshot/image -> dominant palette -> semantic swatches -> contrast hints
```

This is the strongest candidate for an actual dependency or first extraction backend.

### Palette seed corpus

- https://github.com/Experience-Monks/nice-color-palettes

Useful because it provides curated palette JSON arrays from ColourLovers. Good as a baseline palette corpus for comparison, random seeding, and taste calibration.

Likely role:

```text
reference corpus -> palette examples -> nearest-neighbour / inspiration seed
```

Do not expose source identity in builder briefs. Treat as palette corpus data, not design instructions.

### Palette relationships / transformations

- https://github.com/keithallatt/color-namer-palette
- https://github.com/jcrispinroundtree/ColorPaletteRandomizer
- https://github.com/Korben-Coffman/Palette-Generator
- https://github.com/brettalford/Color-Palette-Generator

Useful as references for:

- complementary colors
- analogous colors
- triadic colors
- monochromatic variants
- hue shifts
- lightness/saturation variants
- locking a base color while generating alternates

Likely role:

```text
algorithm references -> reimplement small tested functions in our own toolkit
```

Do not blindly vendor these. Several are small demos or older/simple repos. Use them to compare technique and terminology.

## First Implementation Bias

Prefer Node/TypeScript if this needs to plug into the current website/a-eyes tooling.

First practical stack:

```text
Node CLI
colorthief or equivalent extraction backend
OKLCH/LCH color transforms
WCAG contrast checks
JSON run manifests
CSS variable export
```

Avoid starting with a model-heavy system. Use deterministic scripts for:

- palette extraction
- contrast scoring
- hue rotation
- lightness/chroma adjustment
- token export

Use AI only for:

- summarizing visual style
- scrubbing reference identity
- turning extracted traits into builder-facing prose

## Data Model

Private raw reference:

```json
{
  "schema": "rizzfizz.raw-reference.v1",
  "source_type": "url|image|markdown|design-md|note",
  "source_locator": "",
  "captured_at": "",
  "private_notes": "",
  "raw_text": "",
  "image_paths": [],
  "provenance": {}
}
```

Scrubbed design Markdown:

```text
DESIGN-neutral-<slug>.md
DESIGN-variant-1.md
DESIGN-variant-2.md
DESIGN-variant-3.md
DESIGN-variant-4.md
DESIGN-variant-5.md
```

Each generated design MD should keep:

- abstract visual theme
- typography relationship, using generic roles if exact fonts are source-identifying
- palette relationship
- layout principles
- component behavior
- spacing and density
- builder-ready design guidance

Each generated design MD should remove or transform:

- source URL
- organization/person/client name
- platform/theme name
- exact proprietary font names unless deliberately retained as public style notes
- exact brand colour identity when the goal is inspiration rather than recreation
- category names that identify the source
- instructions that imply cloning the source site

Scrubbed design DNA:

```json
{
  "schema": "rizzfizz.design-dna.v1",
  "source_reference_ids": [],
  "identity_scrubbed": true,
  "mood": [],
  "layout_traits": [],
  "interaction_traits": [],
  "motion_traits": [],
  "palette_traits": [],
  "avoid_copying": [],
  "builder_summary": ""
}
```

Palette run:

```json
{
  "schema": "rizzfizz.palette-run.v1",
  "created_at": "",
  "source_dna": "",
  "variants": [
    {
      "id": "palette-1",
      "name": "",
      "strategy": "extracted|analogous|complementary|triadic|monochrome|curated-seed|hybrid",
      "tokens": {
        "background": "",
        "surface": "",
        "text": "",
        "muted_text": "",
        "primary": "",
        "secondary": "",
        "accent": "",
        "border": ""
      },
      "contrast": {
        "body_text": "pass|fail",
        "button_text": "pass|fail"
      },
      "relationship_preserved": true,
      "usage_notes": ""
    }
  ]
}
```

Design MD variation run:

```json
{
  "schema": "rizzfizz.design-md-variation-run.v1",
  "source_design_md": "",
  "identity_scrubbed": true,
  "preserved_relationships": [
    "dark dominant base with sparse high-chroma accent",
    "editorial serif reading layer plus grotesque UI layer",
    "category accent system"
  ],
  "removed_identity_markers": [],
  "outputs": [
    {
      "id": "design-variant-1",
      "path": "DESIGN-variant-1.md",
      "palette_run": "palette-run.json",
      "notes": ""
    }
  ]
}
```

## Integration With a-eyes

Later, `a-eyes` can call this before builder execution:

```text
01 intake -> rizzfizz palette/design DNA/design MD variation -> 02 builder variants -> 03 review -> 04 eval
```

Potential artifacts:

```text
rizzfizz/
  raw-reference.json
  scrubbed-design-dna.json
  DESIGN-neutral.md
  DESIGN-variant-1.md
  DESIGN-variant-2.md
  design-md-variation-run.json
  palette-run.json
  tokens.css
  builder-palette-brief.md
```

02 builders should receive:

- selected palette tokens
- alternate palette options
- palette usage guidance
- scrubbed design DNA
- optionally one scrubbed design MD file per variant

They should not receive:

- source brand names
- “copy this site” instructions
- exact reference screenshots unless explicitly needed for visual inspection

## Evaluation Ideas

Palette variants should be scored before reaching builders:

- WCAG text contrast
- accent restraint
- hue/chroma balance
- light/dark surface compatibility
- relationship to requested mood
- not dominated by one tired theme
- distinctness across variants

03/04 can later evaluate:

- did the builder use the tokens correctly?
- did the palette support the concept?
- did contrast survive implementation?
- did alternates produce meaningful design variety?
- did the generated site preserve abstract design relationships without copying source identity?

## Starter Prompt

````markdown
You are building `rizzfizz`, an independent RizzFizz is a CLI-first design intelligence utility.

Work folder:

```text
/Users/max/Documents/Code/rizzfizz
```

Goal:

Create a small tool that ingests design references, extracts palette/style signals, scrubs identifying information, and produces high-quality palette variants plus builder-ready design tokens.

Influence repos:

- https://github.com/lokesh/color-thief
- https://github.com/Experience-Monks/nice-color-palettes
- https://github.com/keithallatt/color-namer-palette
- https://github.com/jcrispinroundtree/ColorPaletteRandomizer
- https://github.com/Korben-Coffman/Palette-Generator
- https://github.com/brettalford/Color-Palette-Generator

Treat those as influences and technology candidates, not mandatory dependencies.

Start CLI-first. Add API later only after CLI contracts are stable.

Required MVP commands:

- `rizzfizz extract --image <path>`
- `rizzfizz scrub-md --input <DESIGN-source.md> --variants <n>`
- `rizzfizz palette --seed <hex> --variants <n>`
- `rizzfizz scrub --input <raw-reference.json>`
- `rizzfizz export --input <palette-run.json> --format css-vars`

Required outputs:

- `raw-reference.json`
- `scrubbed-design-dna.json`
- `DESIGN-neutral.md`
- `DESIGN-variant-*.md`
- `design-md-variation-run.json`
- `palette-run.json`
- `tokens.css`
- `builder-palette-brief.md`

Rules:

- preserve private provenance separately from builder-facing output
- scrub brand/source identity from builder-facing briefs
- scrub design Markdown into neutral and variant design Markdown files
- do deterministic color math before asking AI for taste prose
- score contrast before emitting palettes
- export CSS variables that website builders can use directly
- do not copy reference-site layouts or distinctive brand expression

Final report:

- CLI path
- commands implemented
- sample palette run folder
- contrast results
- CSS token output path
- known limitations
````
