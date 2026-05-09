# RizzFizz Improvement Plan

Status: planning draft
Date: 2026-05-09

## Goal

Improve RizzFizz as a design-intelligence utility for humans and coding agents. The next version should communicate design intent more efficiently, produce richer visual/color/style data, and generate stronger builder outputs for web design and animation.

## Current Strengths

- Clear CLI pipeline: `scrub-md` creates private raw archive, source-safe design DNA, palette variants, CSS tokens, a-eyes tokens, and builder briefs.
- Good artifact boundary: raw source stays separate from builder-facing outputs, and Pidge handoffs omit raw source by default.
- OKLCH color engine already produces sRGB-safe token sets with contrast checks.
- Tests cover the main commands and currently pass with `npm test`.

## Main Gaps

### 1. Builder outputs are too prose-heavy and under-specified

Evidence:
- `src/exports.ts` renders builder briefs as Markdown with a few bullets, palette JSON, technology direction, raw design DNA JSON, and a generic quality bar.
- `src/scrub.ts` emits `DESIGN-neutral.md` and variant Markdown by including `summarize(scrubbedText)` plus broad constraints.

Impact:
- Human readers get useful direction, but agents must infer page structure, component inventory, animation intent, responsive behavior, and acceptance criteria.
- Generated sites may look polished at the surface while missing the intended usable experience.

Plan:
- Add a `build-contract.json` artifact optimized for agents.
- Keep Markdown briefs for humans, but make them a readable rendering of the structured contract.
- Include explicit sections for site type, primary workflow, information architecture, components, layout regions, content density, motion budget, responsive requirements, visual QA checks, and forbidden failure modes.

### 2. Design DNA is still partly derived from scrubbed source slices

Evidence:
- `buildDesignDna()` calls `summarize(scrubbedText)`.
- `buildNeutralDesignMd()` and `buildVariantDesignMd()` embed summarized or full scrubbed source notes.
- `summarize()` truncates text rather than abstracting it into controlled design categories.

Impact:
- Source-safe outputs can still carry distinctive prose shape.
- The artifact is less useful to agents than category-first structured data.

Plan:
- Replace truncation summaries with deterministic extraction buckets:
  - `intent`: site type, audience, primary job, secondary jobs.
  - `composition`: hero behavior, navigation, content rhythm, section density.
  - `visual_style`: mood, geometry, surface model, whitespace, imagery treatment.
  - `interaction`: hover/focus/scroll patterns, expected controls, feedback style.
  - `motion`: entrance, transition, scroll, canvas/3D, reduced-motion fallback.
  - `avoid`: source identity, clone language, decorative traps, accessibility traps.
- Add adversarial fixtures that assert distinctive slogans and source phrasing do not reach builder-facing files.

### 3. Color data needs more design semantics

Evidence:
- `PaletteTokens` has seven useful core tokens: `paper`, `panel`, `ink`, `muted`, `accent`, `accent_strong`, `line`.
- `PaletteRelationship` communicates tone, accent usage, chroma, contrast, and one relationship sentence.
- Palette variants are hue-offset variants of fixed relationship recipes.

Impact:
- Agents receive usable colors, but not enough guidance for real web/UI surfaces: success/error/warning states, focus rings, hover states, gradients, chart colors, shadows, overlays, image treatment, or do/don't swatches.
- Designers cannot quickly see whether a palette is editorial, app-like, gallery-like, cinematic, or animation-friendly beyond the relationship name.

Plan:
- Introduce `visual_tokens.v1` alongside `palette-run.v1`, without breaking current exports.
- Extend each variant with derived semantic tokens:
  - surfaces: `canvas`, `surface`, `surface_raised`, `surface_sunken`, `overlay`.
  - text: `text_primary`, `text_secondary`, `text_inverse`.
  - actions: `action`, `action_hover`, `action_pressed`, `focus_ring`.
  - status: `success`, `warning`, `danger`, `info`.
  - data viz: 6-10 categorical colors, sequential scale, diverging scale, safe neutral grid.
  - effects: `shadow_color`, `glow_color`, `gradient_from`, `gradient_to`.
- Add token usage rules for each token so builders know where not to use them.
- Add contrast checks for action text, focus rings, status labels, and chart labels.

### 4. Animation guidance is not actionable enough

Evidence:
- `visual_effects` contains helpful but broad values such as `short reveal`, `CSS or Motion`, and `Three.js only if real 3D is required`.
- `technologyDirectionForVariant()` chooses Motion/GSAP/Three.js by relationship, but does not emit timelines, trigger rules, frame budgets, or animation acceptance criteria.

Impact:
- Builders may over-animate, under-animate, or use animation as decoration rather than as hierarchy/interaction feedback.
- Animation output quality is hard to evaluate consistently.

Plan:
- Add `motion-contract.json` or a `motion` section inside `build-contract.json`.
- Include:
  - motion level: `none`, `subtle`, `expressive`, `immersive`.
  - allowed techniques: CSS transition, Motion layout/opacity, GSAP timeline, Three.js scene.
  - named patterns: `page_enter`, `section_reveal`, `card_hover`, `nav_transition`, `modal_enter`, `data_update`.
  - exact duration/easing ranges, trigger conditions, stagger limits, reduced-motion behavior.
  - performance budget: no layout thrash, avoid animating width/height/top/left, mobile FPS expectation.
  - QA checks: screenshot plus short capture, no overlapping text, no content hidden behind animation.

### 5. Human ease-of-use needs presets and explainability

Evidence:
- CLI commands are clear, but relationship/hue selection is manual or inferred through simple keyword checks.
- The README explains outputs, but there is no command to preview, compare, or explain why a preset was chosen.

Impact:
- Humans have to inspect many JSON/Markdown files to decide which variant to use.
- Agents receive many files but no compact manifest that says "use this first".

Plan:
- Add `rizzfizz inspect <run>` to print a compact run summary: inferred relationship, hue, variants, warnings, recommended variant, generated files.
- Add `rizzfizz preview --input <run> --out preview.html` for a static visual specimen: tokens, typography, buttons, cards, charts, motion notes.
- Add `rizzfizz explain --input <run>` to show source-safe inference reasons and confidence.
- Add a `run-manifest.json` as the single entrypoint for agents and humans.

## Suggested Milestones

### Milestone 1: Better Agent Contract

Deliverables:
- `build-contract.json` emitted by `scrub-md`.
- `agent-brief` export updated to render the contract into clearer Markdown.
- Tests proving source identity and distinctive copy are absent from all builder-facing files.

Acceptance:
- A builder agent can implement from `build-contract.json` without reading raw source or guessing page structure.
- Existing `palette-run.json`, `tokens.css`, and `variants-palette.json` remain compatible.

### Milestone 2: Visual Tokens V1

Deliverables:
- `visual-tokens.json` with semantic UI, data-viz, and effect tokens.
- CSS export supports grouped variables and comments.
- A-Eyes export can include optional `visual_tokens` while preserving old `palette_tokens`.

Acceptance:
- Generated CSS includes enough tokens for states, charts, overlays, and animation effects.
- Tests cover token presence, valid hex output, and contrast for important pairs.

### Milestone 3: Motion Contract

Deliverables:
- Structured motion contract in generated runs.
- Relationship-specific motion presets for static, editorial, product, gallery, and immersive sites.
- Builder brief includes actionable motion rules and reduced-motion fallback.

Acceptance:
- Briefs tell agents exactly what to animate, what not to animate, and how to verify it.
- Immersive variants get explicit canvas/3D criteria instead of vague permission.

### Milestone 4: Human Preview And Run Summary

Deliverables:
- `rizzfizz inspect`.
- `rizzfizz preview`.
- `run-manifest.json`.

Acceptance:
- A human can choose a variant without opening raw JSON.
- An agent can start from one manifest path and discover all source-safe files.

### Milestone 5: Screenshot/Image Ingestion

Deliverables:
- Add image input support for screenshots.
- Extract dominant colors and representative swatches.
- Generate visual-style hints from image metadata or optional model-assisted extraction.

Acceptance:
- Screenshot inputs can produce the same artifact family as Design Markdown inputs.
- Raw source remains private; builder-facing outputs use abstracted design traits.

## Recommended First Implementation Slice

Start with Milestone 1. It is the highest leverage because it improves every downstream builder without changing the color engine or adding new dependencies.

Concrete first tasks:

1. Add TypeScript types for `BuildContract`, `PageIntent`, `LayoutContract`, `ComponentContract`, `MotionContract`, and `VisualQaContract`.
2. Implement `buildBuildContract(scrubbedText, paletteRun, rawReference, technologyContext)` in a new module, likely `src/contract.ts`.
3. Emit `build-contract.json` and include it in Pidge handoffs.
4. Update `agentBriefMarkdown()` to render the contract instead of dumping broad design DNA JSON.
5. Add tests that assert the generated brief contains specific page/component/motion/QA sections and excludes source identity.

## Verification Baseline

Command run:

```sh
npm test
```

Result:

```text
11 tests passed
```
