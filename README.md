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
rizzfizz scrub-md --input ./DESIGN-source.md --out ./runs/scrub-only --skip-palette   # identity scrub, no colour generation
rizzfizz read --input ./runs/example                    # read-only summary (no generation)
rizzfizz read --input ./palette-run.json
rizzfizz colors --search "ocean blue"                   # 32k+ open colour names (not Pantone)
rizzfizz riff "orange, dark blue grey, 3, +3" --out ./riff.json
rizzfizz --riff "blue green, 3, +5" --seed demo --out ./riff.json
rizzfizz riff "~blue(+10), 3, +3"
rizzfizz riff "~yellow sun(20), orange"
rizzfizz riff "~ALL(-35,-20,-10), orange, 2, +3"
rizzfizz reriff --input ./riff.json --lock '#03719C' --spec "1, +2" --out ./reriff.json
rizzfizz palette --relationship dark-sparse-accent --hue blue --variants 4 --out ./palette-run.json
rizzfizz export --format a-eyes-variant-tokens --input ./palette-run.json --out ./variants-palette.json
rizzfizz export --format a-eyes-intake-variants --input ./runs/example --out ./runs/example/variants.json
rizzfizz export --format agent-brief --input ./runs/example --out ./runs/example/builder-briefs
rizzfizz export --format css-vars --input ./palette-run.json --out ./tokens.css
rizzfizz import-brief-weaver --input /Users/max/Documents/Code/brief-weaver/brief-weaver-runs/<run_id> --out ./runs/<run_id>
rizzfizz tech-scan --url https://example.com --out ./technology-context.json
rizzfizz tech-scan --input ./whiffler-scan.json --out ./technology-context.json
rizzfizz inspect --input ./runs/example
rizzfizz preview --input ./runs/example --out ./runs/example/preview.html
rizzfizz studio --input ./runs/example --out ./runs/example/studio.html --site-name "North Pier" --insp example.com
rizzfizz handoff --input ./runs/example --to gemma --variant variant-1 --expects-response
```

## Studio preview & tokens-only (CLI)

HTML is **optional** and never auto-opened. Pull/insp flags do not imply HTML.

```sh
# Tokens / JSON only (no HTML) + optional Pidge handoff
rizzfizz scrub-md --input ./DESIGN.md --out ./runs/demo --tokens-only \
  --handoff --to gemma --dry-run

rizzfizz export --format tokens-handoff --input ./runs/demo --out ./tokens-handoff.json
rizzfizz handoff --input ./runs/demo --to gemma --tokens-only --dry-run

# Interactive studio (explicit --studio only)
rizzfizz scrub-md --input ./DESIGN.md --out ./runs/demo \
  --insp https://example.com --copy https://example.com --img https://example.com --count 3 \
  --studio --site-name "Quiet Studio" \
  --body "Optional manual body for prompts." \
  --footer "Optional manual footer for prompts."
```

Studio menubar: site · **5 umbrella DS chip** (Swiss / Bento / Neo-Minimalism / Neo-Brutalism / Maximalism + %) · palette count · fonts · swatches · VAR chips · fav/client/collections/reriff · **pencil (✎)** far right.

- Preview: no per-field Edit buttons. Pencil → CMS edit mode (same page, no tabs): all copy editable; presets multi-select / delete / backup JSON; fonts + Google Fonts load; paste palette JSON; save studio state / prompt-copy / accuracy log.
- DS chip click: pick another umbrella → display 100%, previous via hover; logged for accuracy review (`design-system-override`).

Honest gaps: font optical-balance corpus/screenshots (`INSP-VALUE`); `--allcopy` / `--allimg` estimate/queue only.

## Riff / reriff

`riff` builds palette **versions** from locked colour-name dictionary entries (CSS + XKCD survey + meodai/color-names MIT corpus — **not Pantone**), optional generated companions, and spectrum variance:

| Spec | Meaning |
|---|---|
| `blue` | Lock `blue`; default companions + 1 version |
| `blue green, 3, +5` | Lock multi-word `blue green`, generate 3 more (4 total), 5 versions |
| `orange, dark blue grey, 3, +3` | Lock two colours, generate 3, 3 versions |
| `~blue(+10), 3, +3` | Lock blue; vary **up** the hue spectrum up to 10% toward the next named neighbour |
| `~yellow sun(20), orange` | ±20% around `yellow sun`, also lock `orange` |
| `~grey green(-23, +10)` | Asymmetric minus/plus variance |
| `~ALL(10)` | ±10% on a randomly chosen colour each version |
| `~ALL(-35,-20,-10)` | Per-version range list; one random colour rolled inside each range |

Stderr always prints `FLAG` / `WARN` lines (seed, rolls, neighbour-overshoot warnings, `reriff_hint`) before JSON. Use those hex/oklch values with:

```sh
rizzfizz reriff --input ./riff.json --lock '#HEX' --lock 'ocean blue' --spec "2, +3"
```

`--lock` wins over contradictory trailing-spec locks (first / closest to the start of the command).

## Canonical a-eyes Intake Sample

Use this repo-local sample to verify the current a-eyes variant-selection bridge end to end:

```sh
npm run sample:a-eyes-intake
```

That command builds the CLI, uses `test/fixtures/a-eyes-intake/DESIGN.md`, and writes the sample run to `runs/a-eyes-intake-sample/`. To write somewhere else:

```sh
npm run build
node scripts/run-aeyes-intake-sample.mjs --out /tmp/rizzfizz-aeyes-intake-sample
```

The runner executes this coherent flow:

```sh
node bin/cli.js scrub-md --input test/fixtures/a-eyes-intake/DESIGN.md --variants 3 --relationship gallery-neutral --hue green --out runs/a-eyes-intake-sample
node bin/cli.js preview --input runs/a-eyes-intake-sample --out runs/a-eyes-intake-sample/preview.html
node bin/cli.js export --format a-eyes-intake-variants --input runs/a-eyes-intake-sample --out runs/a-eyes-intake-sample/variants.json
node bin/cli.js handoff --input runs/a-eyes-intake-sample --to a-eyes --from codex --kind rizzfizz-a-eyes-intake --variant all --dry-run
```

Expected artifacts:

- `preview.html`: source-safe static variant-selection page.
- `variants.json`: a-eyes intake payload with `master_brief`, `shared_constraints`, and `variants`.
- `pidge/payload-*-a-eyes.json`: dry-run handoff payload; no Pidge send occurs.

RizzFizz does not write legacy a-eyes shim files (`brief.raw.txt` or `brief.structured.json`) as canonical output. See `A-EYES-INTEGRATION-BOUNDARY.md` for the current adapter boundary and mapping from RizzFizz-native artifacts into a-eyes.

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
- `variants.json`: a-eyes intake-compatible master brief, shared constraints, and builder variant briefs.
- `preview.html`: optional static variant-selection page generated by `rizzfizz preview`.
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

## Static Variant Preview

`rizzfizz preview --input <run> --out <html>` reads a completed `scrub-md` run and writes a standalone source-safe HTML page. The page summarizes each variant's palette swatches, typography direction, layout intent, motion notes, and key contract details from `build-contract.json`, `palette-run.json`, `visual-tokens.json`, and `run-manifest.json`.

In the current a-eyes variant-selection flow, use the preview after intake/scrubbing and before builder execution:

```text
01 intake -> rizzfizz scrub-md -> rizzfizz preview -> select variant -> a-eyes builder variants -> review/eval
```

The selected variant maps directly to `variants-palette.json` and the matching `builder-briefs/variant-*.md`. Builders should receive the selected variant's `palette_tokens`, `palette_relationship`, `palette_usage`, `technology_direction`, and source-safe implementation contract. `raw-reference.json` stays private.

## Brief Weaver Bridge

Import an existing Brief Weaver run into the normal RizzFizz run surface:

```sh
cd /Users/max/Documents/Code/rizzfizz
npm install
npm run build
node bin/cli.js import-brief-weaver \
  --input /Users/max/Documents/Code/brief-weaver/brief-weaver-runs/<run_id> \
  --out ./runs/<run_id>
```

Run the full local smoke path from Brief Weaver's frozen contract fixture to a RizzFizz a-eyes dry-run handoff:

```sh
npm run sample:briefweaver-import
```

The command reads Brief Weaver's source-safe outputs:

- `variation-manifest.json`
- `project-brief.json`
- `handoff/briefweaver-project-brief.json`
- `scrubbed/DESIGN-neutral.md`
- `scrubbed/scrubbed-design-dna.json`
- `variants/variants.json`
- `variants/DESIGN-variant-*.md`
- `palettes/palette-run.json`

`project-brief.json` and `handoff/briefweaver-project-brief.json` must use `schemaVersion: "briefweaver.project-brief.v1"`, declare `source_safe: true`, and expose `rizzfizz_import.input_schema: "briefweaver.project-brief.v1"`. Missing or non-source-safe contract files fail the import.

It writes the standard RizzFizz artifacts:

- `run-manifest.json`
- `scrubbed-design-dna.json`
- `build-contract.json`
- `visual-tokens.json`
- `palette-run.json`
- `variants-palette.json`
- `variants.json`
- `DESIGN-neutral.md`
- `DESIGN-variant-*.md`
- `builder-briefs/variant-*.md`
- `preview.html`

Source-safe boundary: `raw/` and `source-manifest.json` from Brief Weaver are not copied into builder-facing artifacts. RizzFizz writes `raw-reference.json` as private provenance metadata with `raw_text` empty and pointers back to the original Brief Weaver run. Use `--no-preview` only when you want to skip `preview.html`.

## Waffle Whiffler Technology Feed

`rizzfizz` can consume `/Users/max/Documents/Code/whiffler` without importing its internals:

```sh
rizzfizz tech-scan --url https://example.com --out ./technology-context.json
rizzfizz scrub-md --input ./DESIGN-source.md --tech-scan ./whiffler-scan.json --variants 4 --out ./runs/example
rizzfizz scrub-md --input ./DESIGN-source.md --tech-url https://example.com --variants 4 --out ./runs/example
```

The accepted input is Whiffler's saved `--json` scan contract: top-level `url`, `status`, `technologies`, `features`, and `aggressive`, with each technology carrying confidence, categories, versions, and evidence records. `technology-context.json` does not copy the raw scan forward. It writes a compact source-safe summary with:

- `scan`: status, passive/aggressive mode, and feature counts with the scanned URL redacted.
- `detected`: promoted technologies with confidence, confidence label, categories, versions, evidence channels, and strongest redacted evidence.
- `weak_signals`: lower-confidence detections preserved as cautionary evidence, not stack requirements.
- `recommendations`: stack-fit guidance, builder-use notes, cautions, and `do_not_clone` notes.

RizzFizz only promotes technologies with confidence of at least 30 into `technology-context.json.detected`. Lower-confidence hits remain in `weak_signals` so agents can see the caution without treating weak text matches as a stack requirement.

Example shape:

```json
{
  "schema": "rizzfizz.technology-context.v2",
  "source_safe": true,
  "scan": { "url": "redacted", "status": 200, "aggressive": false },
  "detected": [
    {
      "name": "Next.js",
      "confidence": 100,
      "confidence_label": "high",
      "evidence_channels": ["scriptSrc"],
      "strongest_evidence": [
        { "channel": "scriptSrc", "confidence": 100, "pattern": "_next/static", "value_kind": "url" }
      ]
    }
  ],
  "recommendations": {
    "stack_fit": "Modern frontend framework signals detected...",
    "do_not_clone": ["Do not copy source URLs, file paths, headers, cookies, class names, or tracking snippets."]
  }
}
```

When `technology-context.json` is present, `variants.json` includes the stack-fit summary, top technology evidence, weak signals, cautions, and `do_not_clone` notes under each variant's `technology_direction.source_technology_context`. `rizzfizz preview` also shows a "Stack Fit Evidence" section so the human variant-selection step can see why a stack is recommended and what source-site implementation details must not be copied.

## a-eyes Intake Export

`scrub-md` writes `variants.json` automatically. You can also regenerate it from a run directory:

```sh
rizzfizz export --format a-eyes-intake-variants --input ./runs/example --out ./runs/example/variants.json
```

This export matches the current a-eyes intake contract: top-level `master_brief`, `shared_constraints`, and `variants`. It reuses `build-contract.json` for intent, layout, component, motion, and visual QA requirements; `palette-run.json` for stable variant IDs and palette tokens; and `technology-context.json`, when present, for detected source technology context and stack-fit cautions.

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
- `variants.json`
- `tokens.css`
- `technology-context.json`, when present
- selected `DESIGN-variant-*.md`
- selected `builder-briefs/variant-*.md`

`raw-reference.json` is not attached unless `--include-raw` is explicitly set.

## Limitations

V1 uses deterministic text heuristics for scrubbing and design DNA extraction. It does not yet ingest screenshots, run browser extraction, call an LLM, export W3C Design Tokens, or create an interactive palette editor.
