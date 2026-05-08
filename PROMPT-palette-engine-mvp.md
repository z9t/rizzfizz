# Coding Agent Prompt: rizzfizz Palette Engine MVP

You are implementing the first MVP of `rizzfizz`, a deterministic local CLI that generates high-quality palette tokens for the a-eyes website pipeline.

This prompt was prepared from the local Fabric prompt-improvement lane using `fabric improve_prompt --suppress-think`. The exact pattern name `prompt_improver` was not registered in this Fabric install.

## Objective

Build a working Node ESM or TypeScript CLI in:

```text
/Users/max/Documents/Code/rizzfizz
```

The CLI should generate palette outputs compatible with the existing a-eyes variant shape:

```json
{
  "palette_tokens": {
    "paper": "#ffffff",
    "panel": "#f5f5f5",
    "ink": "#1a1a1a",
    "muted": "#6b7280",
    "accent": "#3b82f6",
    "accent_strong": "#2563eb",
    "line": "#e5e7eb"
  },
  "palette_relationship": {
    "tone": "dark",
    "accent_usage": "sparse",
    "contrast": "high text contrast",
    "relationship": "dark base, layered low-chroma surface, bright accent used carefully"
  },
  "palette_usage": "Use accent sparingly for focus, links, active states, and one primary callout."
}
```

## Read First

Inspect the actual files before coding:

```text
/Users/max/Documents/Code/rizzfizz/START-HERE.md
/Users/max/Documents/Code/rizzfizz/GitHubPalleteRepos/color_approaches_report.md
/Users/max/Documents/Code/rizzfizz/GitHubPalleteRepos/colourselect_techreqs.md
/Users/max/Documents/Code/a-eyes-workstreams/01-alfred-fabric-intake/bin/zalf-web
/Users/max/Documents/Code/a-eyes-workstreams/01-alfred-fabric-intake/PALETTE-VARIATION.md
/Users/max/Documents/Code/a-eyes-workstreams/02-builder-harness-a-eyes/scripts/build-harness.mjs
```

Use the reports as guidance, not as files to modify. Preserve everything under `GitHubPalleteRepos/`.

## Important Context

The current a-eyes intake already emits `palette_tokens`, `palette_relationship`, `palette_usage`, and `technology_direction`, but the palette generation is intentionally basic and inline. This MVP should create the deterministic palette engine that can later replace that inline logic.

Do not modify the a-eyes workstreams in this task. Build `rizzfizz` as a separate utility and keep its output compatible with a-eyes.

## Commands To Support

Implement these commands:

```sh
rizzfizz palette --seed "#68b7ff" --mode scale --out palette-run.json
rizzfizz palette --relationship dark-sparse-accent --hue blue --variants 5 --out palette-run.json
rizzfizz export --format a-eyes-variant-tokens --input palette-run.json --out variants-palette.json
```

It is fine if the executable is initially run as:

```sh
node bin/cli.js palette ...
```

But `package.json` should expose a `bin` entry so `npm link` can provide `rizzfizz`.

## Implementation Requirements

### Color Engine

Implement color work in OKLCH/OKLab, preferably using `culori` unless a direct implementation is smaller and well-tested.

Requirements:

- Avoid naive RGB/HSL generation for internal palette operations.
- Support hex input and hex output.
- Support OKLCH interpolation with correct hue wraparound across 0/360 degrees.
- Support anchor-based generation.
- Include at least `linear` and `ease-in-out` interpolation.
- Keep all output colors sRGB-safe hex values.

### Palette Modes

Support at least:

- `scale`: seed-based palette scale for UI token generation.
- `relationship`: relationship preset generation.

Initial relationship preset:

```text
dark-sparse-accent
```

Behavior:

- dark base
- layered low-chroma panel
- high-contrast text
- sparse high-chroma accent
- muted secondary text
- subtle border line

Also support a simple hue family input such as:

```text
blue, green, amber, coral, violet
```

### Required Tokens

Every generated palette must include:

```text
paper
panel
ink
muted
accent
accent_strong
line
```

Also include:

```text
palette_relationship
palette_usage
checks
```

`checks` should contain contrast results and warnings/failures.

### Quality Checks

Implement WCAG contrast checks.

Required pairs:

- `ink` on `paper`
- `ink` on `panel`
- `muted` on `paper`
- `accent` on `paper`
- `accent` on `panel`

Rules:

- Fail hard if `ink/paper` or `ink/panel` is below 4.5.
- Warn if `muted/paper` is below 3.0.
- Warn if accent contrast is weak, but do not hard-fail the MVP unless it makes the palette unusable.
- For `--variants`, ensure generated variants are meaningfully distinct. A simple hue-distance or OKLCH-distance check is enough for MVP.

## Suggested File Structure

Use this structure or a close equivalent:

```text
rizzfizz/
  bin/
    cli.js
  src/
    color-engine/
      oklch.js
      interpolation.js
      generator.js
    quality-checks/
      contrast.js
      validator.js
    relationships/
      preset-relationships.js
    tokens/
      builder.js
    export/
      a-eyes-format.js
  test/
    color-engine.test.js
    contrast.test.js
    cli.test.js
    fixtures/
      seed-output.json
      relationship-output.json
  examples/
    sample-runs/
  package.json
  README.md
  HANDOFF.md
```

Keep the project no larger than it needs to be.

## Package Scripts

Add useful scripts:

```json
{
  "scripts": {
    "check": "node --check bin/cli.js && find src test -name '*.js' -print0 | xargs -0 -n1 node --check",
    "test": "node --test",
    "smoke": "node bin/cli.js palette --seed '#68b7ff' --mode scale --out /tmp/rizzfizz-smoke-palette.json && node bin/cli.js export --format a-eyes-variant-tokens --input /tmp/rizzfizz-smoke-palette.json --out /tmp/rizzfizz-smoke-aeyes.json"
  }
}
```

If you choose TypeScript or Vitest, update the scripts accordingly and keep them runnable.

## Tests

Add focused tests for:

- hex parsing and output normalization
- OKLCH interpolation
- hue wraparound, especially 350 degrees to 10 degrees
- `ease-in-out` interpolation shape
- WCAG contrast calculation
- required token presence
- CLI palette command writes output
- CLI export command writes a-eyes-compatible JSON

Do not overbuild test infrastructure. The aim is reliable local verification.

## README

Document:

- what this utility does
- why OKLCH/OKLab is used
- command examples
- output shape
- contrast rules
- current limitations
- how a-eyes should consume the output later

## Handoff

Create `HANDOFF.md` with:

```markdown
# RizzFizz Palette Engine MVP Handoff

## Files Created

## Files Modified

## Commands Run

## Verification Result

## Sample Outputs

## Integration Notes For a-eyes

## Known Limitations
```

## Constraints

- Do not modify `/Users/max/Documents/Code/a-eyes-workstreams/`.
- Do not delete, rewrite, or move the worker reports in `GitHubPalleteRepos/`.
- Do not vendor large third-party repositories.
- Do not deploy anything.
- Do not add secrets or environment-variable requirements.
- Do not make live iTerm, Hermes, Claude, Cloudflare, or system configuration changes.

## Acceptance Checks

Before finishing, run:

```sh
npm run check
npm run test
npm run smoke
```

Then report:

- exact files created/modified
- exact commands run
- whether checks passed
- where sample output files are
- one short recommendation for the next integration step

If one verification command cannot run, report the exact command and exact error, then still provide the best usable handoff state.

Begin by inspecting the files listed under "Read First", then implement the MVP.
