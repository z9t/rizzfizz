import { contrastRatio, oklchToHex } from "./color.js";
import type { ContrastCheck, PaletteRun, PaletteTokens, PaletteVariant, VisualTokensRun, VisualTokensVariant } from "./types.js";

export function buildVisualTokensRun(run: PaletteRun, createdAt = new Date().toISOString()): VisualTokensRun {
  return {
    schema: "rizzfizz.visual-tokens.v1",
    created_at: createdAt,
    source_palette_run: run.source,
    variants: run.variants.map(buildVisualTokensVariant)
  };
}

function buildVisualTokensVariant(variant: PaletteVariant): VisualTokensVariant {
  const tokens = variant.tokens;
  const dark = variant.palette_relationship.tone === "dark";
  const visual: VisualTokensVariant = {
    id: variant.id,
    surfaces: {
      canvas: tokens.paper,
      surface: tokens.panel,
      surface_raised: dark ? mixRole(tokens.panel, variant.hue, 0.22, 0.052) : mixRole(tokens.panel, variant.hue, 0.955, 0.018),
      surface_sunken: dark ? mixRole(tokens.paper, variant.hue, 0.075, 0.04) : mixRole(tokens.paper, variant.hue, 0.925, 0.014),
      overlay: dark ? "#000000" : "#FFFFFF"
    },
    text: {
      text_primary: tokens.ink,
      text_secondary: tokens.muted,
      text_inverse: dark ? "#101010" : "#FFFFFF"
    },
    actions: {
      action: tokens.accent,
      action_hover: tokens.accent_strong,
      action_pressed: dark ? mixRole(tokens.accent_strong, variant.hue, 0.54, 0.20) : mixRole(tokens.accent_strong, variant.hue, 0.36, 0.18),
      focus_ring: tokens.accent
    },
    status: {
      success: oklchToHex({ mode: "oklch", l: dark ? 0.74 : 0.48, c: 0.15, h: 150 }),
      warning: oklchToHex({ mode: "oklch", l: dark ? 0.80 : 0.62, c: 0.15, h: 82 }),
      danger: oklchToHex({ mode: "oklch", l: dark ? 0.72 : 0.54, c: 0.18, h: 28 }),
      info: oklchToHex({ mode: "oklch", l: dark ? 0.74 : 0.50, c: 0.15, h: 230 })
    },
    data_viz: {
      categorical: categoricalScale(variant.hue, dark),
      sequential: sequentialScale(variant.hue, dark),
      neutral_grid: tokens.line
    },
    effects: {
      shadow_color: dark ? "#000000" : mixRole(tokens.ink, variant.hue, 0.18, 0.02),
      glow_color: tokens.accent,
      gradient_from: tokens.paper,
      gradient_to: tokens.panel
    },
    usage_rules: usageRules(variant.strategy),
    checks: []
  };
  visual.checks = buildChecks(tokens, visual);
  return visual;
}

function buildChecks(tokens: PaletteTokens, visual: Omit<VisualTokensVariant, "checks">): ContrastCheck[] {
  return [
    contrastCheck("text_primary/canvas", visual.text.text_primary, visual.surfaces.canvas, 4.5, true),
    contrastCheck("text_primary/surface", visual.text.text_primary, visual.surfaces.surface, 4.5, true),
    contrastCheck("text_secondary/canvas", visual.text.text_secondary, visual.surfaces.canvas, 3, false),
    contrastCheck("action/canvas", visual.actions.action, visual.surfaces.canvas, 3, false),
    contrastCheck("focus_ring/canvas", visual.actions.focus_ring, tokens.paper, 3, false)
  ];
}

function contrastCheck(pair: string, foreground: string, background: string, threshold: number, required: boolean): ContrastCheck {
  const ratio = contrastRatio(foreground, background);
  return {
    pair,
    foreground,
    background,
    ratio,
    level: ratio >= threshold ? "pass" : required ? "fail" : "warn",
    threshold,
    required
  };
}

function categoricalScale(baseHue: number, dark: boolean): string[] {
  const hues = [baseHue, baseHue + 52, baseHue - 48, baseHue + 104, baseHue - 96, baseHue + 156, baseHue - 150, baseHue + 204];
  return hues.map((hue, index) => oklchToHex({
    mode: "oklch",
    l: dark ? 0.72 - (index % 2) * 0.08 : 0.54 - (index % 2) * 0.06,
    c: 0.14,
    h: wrapHue(hue)
  }));
}

function sequentialScale(baseHue: number, dark: boolean): string[] {
  const lightness = dark ? [0.32, 0.44, 0.56, 0.68, 0.80] : [0.90, 0.78, 0.64, 0.50, 0.38];
  return lightness.map((l) => oklchToHex({ mode: "oklch", l, c: 0.09, h: baseHue }));
}

function mixRole(fallback: string, hue: number, lightness: number, chroma: number): string {
  try {
    return oklchToHex({ mode: "oklch", l: lightness, c: chroma, h: hue });
  } catch {
    return fallback;
  }
}

function usageRules(relationship: string): string[] {
  if (relationship === "product-clear") {
    return [
      "Use action tokens only for real controls, selected states, and focus.",
      "Use status tokens with labels or icons; never rely on color alone.",
      "Use data-viz tokens for charts, not decorative section backgrounds."
    ];
  }
  if (relationship === "immersive-chroma") {
    return [
      "Use glow and gradient tokens for focal energy only.",
      "Keep data-viz colors legible against dark surfaces.",
      "Do not turn every panel into a glowing surface."
    ];
  }
  if (relationship === "gallery-neutral") {
    return [
      "Use neutral surfaces to let media lead.",
      "Use action and focus tokens sparingly.",
      "Use chart colors only when the page actually contains visualized data."
    ];
  }
  return [
    "Use semantic tokens by role rather than choosing ad hoc colors.",
    "Keep accent/action colors sparse.",
    "Use focus and status tokens consistently across all interactive states."
  ];
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}
