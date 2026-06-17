import type { DesignArchetypeClassification, DesignArchetypeVariantGuidance, DesignSystemClassification } from "./design-system-taxonomy.js";
import { classifyDesignArchetype, classifyDesignSystem, designArchetypeVariantGuidance, designSystemGuidance } from "./design-system-taxonomy.js";
import type { ExtractedPaletteColor, PaletteQualityReport } from "./palette-analysis.js";
import { analyzePaletteFromSource, extractPaletteColorsFromAEyesArtifact, scorePaletteQuality } from "./palette-analysis.js";

type DesignScoreInput = {
  html?: string;
  css?: string;
  javascript?: string;
  text?: string;
  styleText?: string;
  aEyesJson?: unknown;
  aEyesPng?: Uint8Array;
};

export type DesignScoreReport = {
  schema: "rizzfizz.design-score-report.v1";
  source_safe: true;
  inputs: {
    html?: "redacted-local-path";
    css?: "redacted-local-path";
    a_eyes_json?: "redacted-local-path";
    a_eyes_png?: "redacted-local-path";
  };
  report_card: {
    score: number;
    grade: string;
    rubric: Array<{ id: string; label: string; score: number; weight: number; notes: string[] }>;
    strengths: string[];
    warnings: string[];
    summary: string;
  };
  palette: PaletteQualityReport;
  archetype: DesignArchetypeClassification;
  design_system: DesignSystemClassification;
  safe_variation_constraints: {
    locked: string[];
    may_vary: string[];
    verify: string[];
    do_not_clone: string[];
  };
  exportable_guidance: {
    json: {
      palette_constraints: string[];
      archetype_constraints: DesignArchetypeVariantGuidance["variant_constraints"];
      combined_guidance: string[];
      qa_checks: string[];
      do_not_clone: string[];
    };
    markdown: string;
  };
};

export function buildDesignScoreReport(input: DesignScoreInput): DesignScoreReport {
  const sourcePalette = analyzePaletteFromSource({ html: input.html, css: input.css, text: input.text });
  const artifactColors = extractPaletteColorsFromAEyesArtifact({ json: input.aEyesJson, png: input.aEyesPng });
  const colors = mergeColors([...sourcePalette.extracted_colors, ...artifactColors]);
  const palette = scorePaletteQuality(colors);
  const archetype = classifyDesignArchetype({ html: input.html, css: input.css, javascript: input.javascript, text: input.text });
  const archetypeGuidance = designArchetypeVariantGuidance(archetype);
  const styleText = [input.styleText, input.text, input.html, input.css].filter(Boolean).join("\n");
  const designSystem = classifyDesignSystem({ text: styleText, relationship: inferredPaletteRelationship(palette) });
  const rubric = buildRubric(palette, archetype, designSystem, artifactColors.length);
  const score = clamp(Math.round(rubric.reduce((sum, item) => sum + item.score * item.weight, 0)), 0, 100);
  const strengths = buildStrengths(palette, archetype, designSystem, artifactColors.length);
  const warnings = unique([...palette.warnings, ...rubric.flatMap((item) => item.notes.filter((note) => /missing|below|weak|no |narrow|provisional|review/i.test(note)))]);
  const paletteConstraints = paletteGuidance(palette);
  const verify = unique([
    ...archetypeGuidance.variant_constraints.verify,
    "Re-run a-eyes screenshot capture/pixel-diff after variation to verify palette drift, hierarchy, and responsive screenshots.",
    "Verify WCAG 2.2 AA contrast for text/background and interactive state pairs.",
    ...paletteConstraints.filter((item) => /contrast|lightness|accent|role/i.test(item))
  ]);
  const combinedGuidance = unique([
    ...designSystemGuidance(designSystem),
    ...archetypeGuidance.safe_variation_rules,
    ...paletteConstraints
  ]);
  const doNotClone = archetypeGuidance.do_not_clone;
  const constraints = {
    locked: unique([...archetypeGuidance.variant_constraints.locked, "semantic palette roles: background, surface, text, muted, accent, border"]),
    may_vary: unique([...archetypeGuidance.variant_constraints.may_vary, "hue family within the detected harmony", "accent intensity within contrast limits"]),
    verify,
    do_not_clone: doNotClone
  };
  const markdown = guidanceMarkdown({ score, grade: gradeFor(score), palette, archetype, designSystem, constraints, combinedGuidance, paletteConstraints, doNotClone });

  return {
    schema: "rizzfizz.design-score-report.v1",
    source_safe: true,
    inputs: {
      ...(input.html != null ? { html: "redacted-local-path" as const } : {}),
      ...(input.css != null ? { css: "redacted-local-path" as const } : {}),
      ...(input.aEyesJson != null ? { a_eyes_json: "redacted-local-path" as const } : {}),
      ...(input.aEyesPng != null ? { a_eyes_png: "redacted-local-path" as const } : {})
    },
    report_card: {
      score,
      grade: gradeFor(score),
      rubric,
      strengths,
      warnings,
      summary: `Design score ${score}/100 (${gradeFor(score)}): ${palette.summary} Primary archetype ${archetype.primary.name}; design style ${designSystem.primary.name}.`
    },
    palette,
    archetype,
    design_system: designSystem,
    safe_variation_constraints: constraints,
    exportable_guidance: {
      json: {
        palette_constraints: paletteConstraints,
        archetype_constraints: archetypeGuidance.variant_constraints,
        combined_guidance: combinedGuidance,
        qa_checks: verify,
        do_not_clone: doNotClone
      },
      markdown
    }
  };
}

function buildRubric(
  palette: PaletteQualityReport,
  archetype: DesignArchetypeClassification,
  designSystem: DesignSystemClassification,
  artifactColorCount: number
): DesignScoreReport["report_card"]["rubric"] {
  const paletteScore = palette.quality_score;
  const contrastScore = palette.contrast.best_text_on_background ? clamp(Math.round((palette.contrast.best_text_on_background.ratio / 7) * 100), 0, 100) : 0;
  const archetypeScore = clamp(Math.round(archetype.primary.probability * 100), 0, 100);
  const styleScore = clamp(Math.round(designSystem.primary.confidence * 100), 0, 100);
  const artifactScore = artifactColorCount ? 100 : 65;
  return [
    { id: "palette", label: "Palette role coverage and OKLCH quality", score: paletteScore, weight: 0.34, notes: palette.warnings.slice(0, 4) },
    { id: "contrast", label: "Contrast/readability", score: contrastScore, weight: 0.22, notes: contrastScore >= 85 ? ["Strong text/background contrast signal."] : ["Review text/background contrast before export."] },
    { id: "archetype", label: "Implementation archetype confidence", score: archetypeScore, weight: 0.18, notes: [`Primary archetype: ${archetype.primary.name}.`] },
    { id: "style", label: "Design-system style confidence", score: styleScore, weight: 0.16, notes: [`Primary style: ${designSystem.primary.name}.`] },
    { id: "a-eyes", label: "a-eyes artifact intake", score: artifactScore, weight: 0.1, notes: artifactColorCount ? [`Ingested ${artifactColorCount} a-eyes color signal(s).`] : ["No a-eyes PNG/JSON color artifact supplied; score is source-text only."] }
  ];
}

function buildStrengths(
  palette: PaletteQualityReport,
  archetype: DesignArchetypeClassification,
  designSystem: DesignSystemClassification,
  artifactColorCount: number
): string[] {
  const strengths: string[] = [];
  if (palette.role_coverage.score >= 0.8) strengths.push("Strong palette role coverage across semantic roles.");
  if ((palette.contrast.best_text_on_background?.ratio || 0) >= 7) strengths.push("Excellent text/background contrast headroom.");
  if (palette.oklch.lightness_range >= 0.5) strengths.push("Clear OKLCH lightness range supports hierarchy.");
  if (archetype.primary.probability >= 0.45) strengths.push(`Readable implementation archetype signal: ${archetype.primary.name}.`);
  if (designSystem.primary.confidence >= 0.42) strengths.push(`Usable design-system style signal: ${designSystem.primary.name}.`);
  if (artifactColorCount > 0) strengths.push("a-eyes screenshot/pixel-diff palette artifact included in scoring.");
  return strengths.length ? strengths : ["Baseline source-safe design signals extracted for review."];
}

function paletteGuidance(palette: PaletteQualityReport): string[] {
  const guidance = [
    `Keep ${palette.oklch.harmony} palette harmony unless intentionally changing the design direction.`,
    `Maintain semantic palette roles with current coverage score near ${Math.round(palette.role_coverage.score * 100)}%.`,
    "Preserve text/background contrast at WCAG AA or better for body text and key controls."
  ];
  if (palette.oklch.accent_chroma_delta > 0.025) guidance.push("Keep accent chroma visibly separated from neutral/background roles.");
  if (palette.contrast.best_text_on_background) guidance.push(`Use ${palette.contrast.best_text_on_background.foreground} on ${palette.contrast.best_text_on_background.background} as a known strong contrast pairing when roles match.`);
  return guidance;
}

function guidanceMarkdown(args: {
  score: number;
  grade: string;
  palette: PaletteQualityReport;
  archetype: DesignArchetypeClassification;
  designSystem: DesignSystemClassification;
  constraints: DesignScoreReport["safe_variation_constraints"];
  combinedGuidance: string[];
  paletteConstraints: string[];
  doNotClone: string[];
}): string {
  return `# Palette + Archetype Guidance

Report card: **${args.grade} (${args.score}/100)**

## Palette
- quality: ${args.palette.quality_score}/100
- harmony: ${args.palette.oklch.harmony}
- best text/background: ${args.palette.contrast.best_text_on_background ? `${args.palette.contrast.best_text_on_background.ratio}:1` : "not computed"}

## Archetype
- primary: ${args.archetype.primary.name} (${Math.round(args.archetype.primary.probability * 100)}%)
- design system: ${args.designSystem.primary.name} (${args.designSystem.primary.confidence_label})

## Safe Variation Constraints
Locked:
${args.constraints.locked.map((item) => `- ${item}`).join("\n")}

May vary:
${args.constraints.may_vary.map((item) => `- ${item}`).join("\n")}

Verify:
${args.constraints.verify.map((item) => `- ${item}`).join("\n")}

## Combined Guidance
${args.combinedGuidance.map((item) => `- ${item}`).join("\n")}

## Palette Constraints
${args.paletteConstraints.map((item) => `- ${item}`).join("\n")}

## Do not clone
${args.doNotClone.map((item) => `- ${item}`).join("\n")}
`;
}

function inferredPaletteRelationship(palette: PaletteQualityReport): string {
  if (palette.oklch.average_lightness < 0.45 && palette.oklch.accent_chroma_delta > 0.02) return "dark-sparse-accent";
  if (palette.oklch.max_chroma > 0.2 && palette.oklch.hue_clusters.length >= 3) return "immersive-chroma";
  if (palette.oklch.average_lightness > 0.78) return "light-editorial-accent";
  return "product-clear";
}

function mergeColors(colors: ExtractedPaletteColor[]): ExtractedPaletteColor[] {
  const map = new Map<string, ExtractedPaletteColor>();
  for (const color of colors) {
    const key = `${color.hex}|${color.role}|${color.source_kind}|${color.name || ""}|${color.property || ""}`;
    const existing = map.get(key);
    if (existing) existing.count += color.count;
    else map.set(key, { ...color });
  }
  return [...map.values()];
}

function gradeFor(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 60) return "D";
  return "F";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
