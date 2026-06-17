import { basename, join, resolve } from "node:path";
import { buildPaletteRun, cssVarsForPalette, normalizeHueFamily, normalizeRelationship } from "./color.js";
import { buildBuildContract } from "./contract.js";
import { buildDesignScoreReport } from "./design-score.js";
import { classifyDesignSystem } from "./design-system-taxonomy.js";
import { aEyesIntakeVariants, aEyesVariantTokens, writeAgentBriefs } from "./exports.js";
import { readText, writeJson, writeText } from "./io.js";
import { buildRunManifest } from "./manifest.js";
import { buildTechnologyContext, readWhifflerScan, runWhiffler, type TechnologyContext } from "./technology.js";
import type { DesignSystemClassification, PaletteRun, RawReference } from "./types.js";
import { buildVisualTokensRun } from "./visual.js";

type ScrubOptions = {
  input: string;
  variants: number;
  out: string;
  relationship?: string;
  hue?: string;
  techScan?: string;
  techUrl?: string;
  whiffler?: string;
  aggressiveTechScan?: boolean;
};

export async function scrubDesignMarkdown(options: ScrubOptions): Promise<{
  outDir: string;
  paletteRun: PaletteRun;
}> {
  const sourcePath = resolve(options.input);
  const outDir = resolve(options.out);
  const rawText = await readText(sourcePath);
  const rawReference = buildRawReference(sourcePath, rawText);
  const scrubbedText = scrubSourceText(rawText, rawReference.extracted.possible_identity_terms);
  const relationship = normalizeRelationship(options.relationship || inferRelationship(rawText));
  const hue = normalizeHueFamily(options.hue || inferHue(rawText));
  const paletteRun = buildPaletteRun({
    relationship,
    hue,
    variants: options.variants,
    source: sourcePath
  });
  const technologyContext = await maybeBuildTechnologyContext(options);
  const designClassification = classifyDesignSystem({ text: scrubbedText, paletteRun });
  const designScore = buildDesignScoreReport({
    text: scrubbedText,
    styleText: scrubbedText
  });
  const dna = buildDesignDna(scrubbedText, paletteRun, rawReference, designClassification);
  const buildContract = buildBuildContract({ scrubbedText, paletteRun, rawReference, technologyContext, designClassification });
  const visualTokens = buildVisualTokensRun(paletteRun);
  const runManifest = buildRunManifest({ outDir, paletteRun, technologyContext: Boolean(technologyContext) });
  const neutralMd = buildNeutralDesignMd(scrubbedText, paletteRun);
  const variationRun = {
    schema: "rizzfizz.design-md-variation-run.v1",
    source_design_md: sourcePath,
    identity_scrubbed: true,
    preserved_relationships: [
      paletteRun.variants[0]?.palette_relationship.relationship || relationship,
      "role-based typography without proprietary font identity",
      "source-safe layout and motion principles"
    ],
    removed_identity_markers: rawReference.extracted.possible_identity_terms,
    outputs: paletteRun.variants.map((variant) => ({
      id: variant.id,
      path: `DESIGN-${variant.id}.md`,
      palette_run: "palette-run.json",
      notes: variant.palette_usage
    }))
  };

  await writeJson(join(outDir, "raw-reference.json"), rawReference);
  await writeJson(join(outDir, "scrubbed-design-dna.json"), dna);
  await writeJson(join(outDir, "build-contract.json"), buildContract);
  await writeJson(join(outDir, "design-score.json"), designScore);
  await writeJson(join(outDir, "visual-tokens.json"), visualTokens);
  await writeText(join(outDir, "DESIGN-neutral.md"), neutralMd);
  await Promise.all(paletteRun.variants.map((variant) => (
    writeText(join(outDir, `DESIGN-${variant.id}.md`), buildVariantDesignMd(scrubbedText, variant))
  )));
  await writeJson(join(outDir, "design-md-variation-run.json"), variationRun);
  await writeJson(join(outDir, "palette-run.json"), paletteRun);
  await writeText(join(outDir, "tokens.css"), cssVarsForPalette(paletteRun));
  await writeJson(join(outDir, "variants-palette.json"), aEyesVariantTokens(paletteRun, {
    designScoreGuidance: designScore.exportable_guidance ? {
      source: "design-score-report",
      report_card: designScore.report_card,
      palette_constraints: designScore.exportable_guidance.json.palette_constraints,
      archetype_constraints: designScore.exportable_guidance.json.archetype_constraints,
      combined_guidance: designScore.exportable_guidance.json.combined_guidance,
      qa_checks: designScore.exportable_guidance.json.qa_checks,
      do_not_clone: designScore.exportable_guidance.json.do_not_clone
    } : undefined
  }));
  await writeJson(join(outDir, "variants.json"), aEyesIntakeVariants(paletteRun, buildContract, technologyContext, {
    source: "design-score-report",
    report_card: designScore.report_card,
    palette_constraints: designScore.exportable_guidance.json.palette_constraints,
    archetype_constraints: designScore.exportable_guidance.json.archetype_constraints,
    combined_guidance: designScore.exportable_guidance.json.combined_guidance,
    qa_checks: designScore.exportable_guidance.json.qa_checks,
    do_not_clone: designScore.exportable_guidance.json.do_not_clone
  }));
  await writeJson(join(outDir, "run-manifest.json"), runManifest);
  if (technologyContext) await writeJson(join(outDir, "technology-context.json"), technologyContext);
  await writeAgentBriefs(join(outDir, "builder-briefs"), paletteRun, dna, basename(outDir), technologyContext, buildContract, {
    source: "design-score-report",
    report_card: designScore.report_card,
    palette_constraints: designScore.exportable_guidance.json.palette_constraints,
    archetype_constraints: designScore.exportable_guidance.json.archetype_constraints,
    combined_guidance: designScore.exportable_guidance.json.combined_guidance,
    qa_checks: designScore.exportable_guidance.json.qa_checks,
    do_not_clone: designScore.exportable_guidance.json.do_not_clone
  });

  return { outDir, paletteRun };
}

async function maybeBuildTechnologyContext(options: ScrubOptions): Promise<TechnologyContext | undefined> {
  if (options.techScan) return buildTechnologyContext(await readWhifflerScan(options.techScan));
  if (options.techUrl) {
    return buildTechnologyContext(await runWhiffler({
      url: options.techUrl,
      executable: options.whiffler,
      aggressive: options.aggressiveTechScan
    }));
  }
  return undefined;
}

export function buildRawReference(sourcePath: string, rawText: string): RawReference {
  const urls = unique(rawText.match(/https?:\/\/[^\s)>\]]+/g) || []);
  const hexColors = unique(rawText.match(/#[0-9a-fA-F]{6}\b/g) || []).map((value) => value.toUpperCase());
  const possibleFonts = extractFontHints(rawText);
  const identityTerms = extractIdentityTerms(sourcePath, rawText, urls);
  return {
    schema: "rizzfizz.raw-reference.v1",
    source_type: "design-md",
    source_locator: resolve(sourcePath),
    captured_at: new Date().toISOString(),
    private_notes: "Private source archive. Do not feed raw_text or source identity into builder-facing briefs.",
    raw_text: rawText,
    extracted: {
      urls,
      hex_colors: hexColors,
      possible_fonts: possibleFonts,
      possible_identity_terms: identityTerms
    },
    provenance: {
      tool: "rizzfizz",
      command: "scrub-md"
    }
  };
}

export function scrubSourceText(rawText: string, identityTerms: string[]): string {
  let text = rawText
    .replace(/https?:\/\/[^\s)>\]]+/g, "[source URL removed]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/\b(?:recreate|clone|copy exactly|copy this|pixel-perfect copy|duplicate)\b/gi, "draw inspiration from");

  for (const term of identityTerms) {
    if (term.length < 3) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[source identity removed]");
  }

  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildDesignDna(
  scrubbedText: string,
  paletteRun: PaletteRun,
  rawReference: RawReference,
  designClassification: DesignSystemClassification
): Record<string, unknown> {
  const firstVariant = paletteRun.variants[0];
  const summary = summarize(scrubbedText);
  return {
    schema: "rizzfizz.design-dna.v1",
    source_reference_ids: [rawReference.source_locator],
    identity_scrubbed: true,
    builder_summary: summary,
    avoid_copying: [
      "Do not use source brand names, URLs, category names, distinctive copy, or clone language.",
      "Preserve abstract relationships only: palette, density, hierarchy, motion feel, and interaction principles."
    ],
    design_system: {
      color: {
        palette_type: paletteRun.relationship,
        primary: { hex: firstVariant.tokens.accent, role: "primary accent and focus color" },
        secondary: { hex: firstVariant.tokens.accent_strong, role: "strong accent for active states" },
        accent: { hex: firstVariant.tokens.accent, role: firstVariant.palette_relationship.accent_usage },
        neutral: {
          scale: {
            paper: firstVariant.tokens.paper,
            panel: firstVariant.tokens.panel,
            ink: firstVariant.tokens.ink,
            muted: firstVariant.tokens.muted,
            line: firstVariant.tokens.line
          },
          usage: "Use neutrals for most surfaces and text; use accent only according to palette_usage."
        },
        surface: {
          background: firstVariant.tokens.paper,
          card: firstVariant.tokens.panel,
          elevated: firstVariant.tokens.panel
        },
        contrast_strategy: "WCAG 2.2 AA body text contrast; visible focus rings; accent checked but allowed to be decorative when contrast is weak."
      },
      typography: {
        font_families: {
          heading: "role-based premium heading family, source-safe substitute",
          body: "high-readability body family, source-safe substitute",
          mono: "system monospace for code or technical labels"
        },
        font_style_notes: "Preserve typographic relationship and hierarchy, not proprietary source font identity.",
        type_scale: {
          display: { size: "clamp(2.5rem, 6vw, 6rem)", weight: "650-800", line_height: "0.95-1.05", tracking: "0" },
          heading_1: { size: "clamp(2rem, 4vw, 4rem)", weight: "650-750", line_height: "1.05", tracking: "0" },
          heading_2: { size: "clamp(1.5rem, 2.5vw, 2.5rem)", weight: "600-700", line_height: "1.12", tracking: "0" },
          body: { size: "1rem", weight: "400", line_height: "1.55-1.7", tracking: "0" },
          caption: { size: "0.8125rem", weight: "500", line_height: "1.35", tracking: "0" }
        }
      },
      spacing: {
        base_unit: "4px",
        scale: ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"],
        content_density: inferDensity(scrubbedText),
        section_rhythm: "Use consistent section rhythm; keep fixed-format controls from resizing on hover or state change."
      },
      layout: {
        grid_system: "responsive CSS Grid/Flexbox with container queries where useful",
        max_content_width: "1120px-1440px depending on site type",
        columns: "content-led responsive columns",
        gutter: "24px desktop, 16px mobile",
        breakpoints: ["390px", "768px", "1024px", "1280px"],
        alignment_tendency: "preserve abstract source hierarchy without source-specific layout copying"
      },
      shape: {
        border_radius: { small: "4px", medium: "8px", large: "12px", pill: "999px" },
        border_usage: "Use borders for structure and focus, not decoration overload.",
        divider_style: "Subtle tokenized line color."
      },
      motion: {
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        duration_scale: { micro: "120ms", normal: "220ms", macro: "600ms" },
        entrance_pattern: "short reveal that supports hierarchy",
        exit_pattern: "instant or short fade",
        philosophy: "restrained, purposeful, reduced-motion aware"
      },
      components: {
        button_style: "clear tokenized buttons with visible focus",
        input_style: "accessible native or Radix-backed controls",
        card_style: "use cards only for repeated items/tools, not nested page sections",
        navigation_pattern: "predictable responsive navigation",
        modal_style: "Radix/shadcn for app modals when React stack is used",
        list_style: "scan-friendly spacing and labels",
        component_notes: "Use lucide icons for common actions when applicable."
      }
    },
    design_style: {
      classification: designClassification,
      aesthetic: {
        mood: inferMood(scrubbedText, firstVariant.palette_relationship.tone),
        visual_metaphor: "source-safe abstract visual system",
        era_influence: "contemporary high-end web design",
        genre: "premium website aid",
        personality_traits: ["precise", "polished", "calm", "builder-ready"],
        adjectives: ["high-contrast", "disciplined", "responsive", "source-safe"]
      },
      visual_language: {
        complexity: "moderate",
        ornamentation: "low unless immersive effects are explicitly requested",
        whitespace_usage: inferWhitespace(scrubbedText),
        visual_weight_distribution: "clear primary view with supporting dense details",
        focal_strategy: "one main focal path per viewport",
        contrast_level: firstVariant.palette_relationship.contrast,
        texture_usage: "avoid decorative noise unless source-safe and performance-appropriate"
      },
      composition: {
        hierarchy_method: "scale, contrast, spacing, and restrained motion",
        balance_type: "content-led",
        flow_direction: "top-to-bottom with strong first viewport",
        grouping_strategy: "semantic sections and repeated components",
        negative_space_role: "improve scan clarity"
      },
      interaction_feel: {
        feedback_style: "visible, fast, accessible",
        hover_behavior: "subtle transform/color changes without layout shift",
        transition_personality: "quiet confidence",
        loading_style: "avoid unnecessary loaders; skeletons for app-like UI",
        microinteraction_density: "low to moderate"
      },
      brand_voice_in_ui: {
        tone: "clear and premium",
        formality: "professional",
        cta_style: "literal, action-oriented",
        empty_state_approach: "plain and useful",
        error_tone: "specific and recoverable"
      }
    },
    visual_effects: {
      overview: {
        effect_intensity: firstVariant.strategy === "immersive-chroma" ? "medium-heavy" : "light",
        performance_tier: firstVariant.strategy === "immersive-chroma" ? "medium" : "lightweight",
        fallback_strategy: "Disable non-essential motion/effects for prefers-reduced-motion and low-end devices.",
        primary_technology: firstVariant.strategy === "immersive-chroma" ? "GSAP or Three.js when justified" : "CSS transitions, Motion, or GSAP only when useful"
      },
      background_effects: { type: "tokenized", description: "Use palette-derived backgrounds; avoid source-signature imagery.", technology: "CSS" },
      particle_systems: { enabled: false },
      "3d_elements": { enabled: firstVariant.strategy === "immersive-chroma", technology: "Three.js only if real 3D is required" },
      shader_effects: { enabled: false },
      scroll_effects: { parallax: { enabled: false }, scroll_triggered_animations: { enabled: true, animation_type: "short reveal" } },
      text_effects: { type: "subtle", technology: "CSS or Motion", description: "No distracting type effects for body text." },
      cursor_effects: { enabled: false }
    }
  };
}

function buildNeutralDesignMd(scrubbedText: string, paletteRun: PaletteRun): string {
  return `# Source-Safe Design Direction

${summarize(scrubbedText)}

## Preserved Abstract Traits

- Palette relationship: ${paletteRun.variants[0]?.palette_relationship.relationship}
- Typography relationship: preserve hierarchy and role, not proprietary font identity.
- Layout: preserve density, hierarchy, and interaction feel without source-specific copying.
- Motion: restrained, responsive, and reduced-motion aware.

## Source-Safe Notes

${scrubbedText}
`;
}

function buildVariantDesignMd(scrubbedText: string, variant: PaletteRun["variants"][number]): string {
  return `# ${variant.name}

## Builder Direction

${summarize(scrubbedText)}

Use this variant's palette and relationship rather than choosing colors from scratch.

## Palette

\`\`\`json
${JSON.stringify(variant.tokens, null, 2)}
\`\`\`

${variant.palette_usage}

## Constraints

- Build the actual usable experience, not a generic landing page.
- Do not use source brand names, URLs, distinctive phrasing, or clone instructions.
- Use semantic HTML, responsive layout, visible focus states, and WCAG 2.2 AA body text contrast.
- Verify desktop and mobile screenshots before finishing.
`;
}

function inferRelationship(rawText: string): string {
  const text = rawText.toLowerCase();
  if (text.includes("immersive") || text.includes("webgl") || text.includes("3d") || text.includes("cinematic")) return "immersive-chroma";
  if (text.includes("portfolio") || text.includes("gallery") || text.includes("photography") || text.includes("image-first")) return "gallery-neutral";
  if (text.includes("dashboard") || text.includes("saas") || text.includes("product") || text.includes("form")) return "product-clear";
  if (text.includes("editorial") || text.includes("documentation") || text.includes("blog") || text.includes("reading")) return "light-editorial-accent";
  if (text.includes("light") && !text.includes("dark")) return "light-editorial-accent";
  return "dark-sparse-accent";
}

function inferHue(rawText: string): string {
  const text = rawText.toLowerCase();
  for (const hue of ["blue", "green", "amber", "coral", "violet", "red", "teal", "cyan", "rose"]) {
    if (text.includes(hue)) return hue;
  }
  return "blue";
}

function extractFontHints(rawText: string): string[] {
  const hints = new Set<string>();
  for (const line of rawText.split("\n")) {
    if (!/(font|typeface|typography)/i.test(line)) continue;
    const quoted = line.match(/["'`](.+?)["'`]/g) || [];
    for (const item of quoted) hints.add(item.replace(/^["'`]|["'`]$/g, ""));
    const afterColon = line.split(":").slice(1).join(":").trim();
    if (afterColon) hints.add(afterColon.slice(0, 120));
  }
  return [...hints].filter(Boolean);
}

function extractIdentityTerms(sourcePath: string, rawText: string, urls: string[]): string[] {
  const terms = new Set<string>();
  const stem = basename(sourcePath).replace(/\.[^.]+$/, "").replace(/^DESIGN[-_]?/i, "");
  for (const token of stem.split(/[^a-zA-Z0-9]+/)) {
    if (token.length >= 3) terms.add(token);
  }
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      for (const token of host.split(/[^a-zA-Z0-9]+/)) {
        if (token.length >= 3 && !["com", "net", "org", "dev", "app", "io"].includes(token)) terms.add(token);
      }
    } catch {
      // Ignore malformed URLs captured by the broad regex.
    }
  }
  for (const line of rawText.split("\n").slice(0, 25)) {
    const heading = line.match(/^#\s+(.+)/);
    if (heading) {
      for (const token of heading[1].split(/[^a-zA-Z0-9]+/)) {
        if (token.length >= 4) terms.add(token);
      }
    }
    const labeled = line.match(/^(?:brand|client|source|site|company|project)\s*:\s*(.+)$/i);
    if (labeled) {
      for (const token of labeled[1].split(/[^a-zA-Z0-9]+/)) {
        if (token.length >= 3) terms.add(token);
      }
    }
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

function summarize(text: string): string {
  const plain = text
    .replace(/^#+\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "Premium source-safe website direction with disciplined palette, typography, layout, and motion guidance.";
  return plain.length > 520 ? `${plain.slice(0, 517).trim()}...` : plain;
}

function inferDensity(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("dense") || lower.includes("dashboard") || lower.includes("table")) return "dense but organized";
  if (lower.includes("minimal") || lower.includes("spacious") || lower.includes("gallery")) return "spacious";
  return "moderate";
}

function inferWhitespace(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("dense") || lower.includes("dashboard")) return "compact with clear grouping";
  if (lower.includes("minimal") || lower.includes("spacious") || lower.includes("luxury")) return "generous";
  return "balanced";
}

function inferMood(text: string, tone: string): string[] {
  const lower = text.toLowerCase();
  const moods = new Set<string>([tone, "premium"]);
  for (const mood of ["calm", "editorial", "technical", "cinematic", "playful", "minimal", "luxury", "precise"]) {
    if (lower.includes(mood)) moods.add(mood);
  }
  return [...moods];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
