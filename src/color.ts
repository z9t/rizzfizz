import culori from "./culori-require.js";
import type { ContrastCheck, PaletteRelationship, PaletteRun, PaletteTokens, PaletteVariant } from "./types.js";

type OklchColor = { mode: "oklch"; l: number; c: number; h: number };

const toRgb = culori.converter("rgb");

const HUE_FAMILIES: Record<string, number> = {
  blue: 252,
  green: 154,
  amber: 78,
  coral: 34,
  violet: 302,
  red: 28,
  teal: 188,
  cyan: 215,
  rose: 12,
  neutral: 245
};

const RELATIONSHIPS: Record<string, Omit<PaletteRelationship, "relationship"> & { relationship: string }> = {
  "dark-sparse-accent": {
    tone: "dark",
    accent_usage: "sparse",
    chroma: "low-chroma base with one clearer accent",
    contrast: "high text contrast",
    relationship: "dark dominant base, layered low-chroma surface, high-contrast text, sparse high-chroma accent"
  },
  "light-editorial-accent": {
    tone: "light",
    accent_usage: "sparse",
    chroma: "warm near-neutral paper with restrained editorial accent",
    contrast: "high text contrast",
    relationship: "light reading surface, crisp ink, muted secondary text, one refined accent"
  },
  "gallery-neutral": {
    tone: "neutral",
    accent_usage: "sparse",
    chroma: "near-neutral gallery surfaces with a quiet accent",
    contrast: "high text contrast",
    relationship: "image-first neutral base, quiet panels, crisp labels, accent reserved for navigation state"
  },
  "product-clear": {
    tone: "light",
    accent_usage: "moderate",
    chroma: "clean neutral product UI with one clear action color",
    contrast: "high text contrast",
    relationship: "bright paper, white panels, readable product copy, action color for controls and focus"
  },
  "immersive-chroma": {
    tone: "dark",
    accent_usage: "expressive",
    chroma: "dark immersive base with controlled luminous accents",
    contrast: "high text contrast",
    relationship: "cinematic dark base, dimensional panels, bright accent used for focal energy"
  }
};

export function normalizeHueFamily(hueFamily: string | undefined): string {
  const key = String(hueFamily || "blue").trim().toLowerCase();
  return HUE_FAMILIES[key] == null ? "blue" : key;
}

export function normalizeRelationship(relationship: string | undefined): string {
  const key = String(relationship || "dark-sparse-accent").trim().toLowerCase();
  return RELATIONSHIPS[key] == null ? "dark-sparse-accent" : key;
}

export function oklchToHex(input: OklchColor): string {
  const rgb = toRgb(input);
  if (!rgb) throw new Error(`Unable to convert OKLCH color ${JSON.stringify(input)}`);
  return culori.formatHex(culori.clampRgb(rgb)).toUpperCase();
}

export function parseHexToOklch(hex: string): OklchColor {
  const parsed = culori.parse(hex);
  if (!parsed) throw new Error(`Invalid color: ${hex}`);
  const converted = culori.converter("oklch")(parsed);
  if (!converted || typeof converted.l !== "number" || typeof converted.c !== "number") {
    throw new Error(`Unable to convert color to OKLCH: ${hex}`);
  }
  const hue = typeof converted.h === "number" ? converted.h : 0;
  return {
    mode: "oklch",
    l: converted.l,
    c: converted.c ?? 0,
    h: hue
  };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function interpolateOklch(a: OklchColor, b: OklchColor, t: number, easing: "linear" | "ease-in-out" = "linear"): OklchColor {
  const x = easing === "ease-in-out" ? easeInOut(t) : t;
  let h1 = a.h;
  let h2 = b.h;
  if (Math.abs(h2 - h1) > 180) {
    if (h1 < h2) h1 += 360;
    else h2 += 360;
  }
  return {
    mode: "oklch",
    l: a.l + (b.l - a.l) * x,
    c: a.c + (b.c - a.c) * x,
    h: ((h1 + (h2 - h1) * x) % 360 + 360) % 360
  };
}

export function contrastRatio(foreground: string, background: string): number {
  const fg = hexToRgbTriplet(foreground);
  const bg = hexToRgbTriplet(background);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function hexToRgbTriplet(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) throw new Error(`Expected 6-digit hex color, got ${hex}`);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function buildPaletteRun(options: {
  relationship?: string;
  hue?: string;
  variants?: number;
  source?: string;
  createdAt?: string;
}): PaletteRun {
  const relationship = normalizeRelationship(options.relationship);
  const hueFamily = normalizeHueFamily(options.hue);
  const count = Math.max(1, Math.min(12, Number(options.variants || 4)));
  const baseHue = HUE_FAMILIES[hueFamily];
  const offsets = variantHueOffsets(count);
  const variants = offsets.map((offset, index) => buildPaletteVariant({
    id: `variant-${index + 1}`,
    relationship,
    hueFamily,
    hue: wrapHue(baseHue + offset),
    index
  }));
  return {
    schema: "rizzfizz.palette-run.v1",
    created_at: options.createdAt || new Date().toISOString(),
    relationship,
    hue_family: hueFamily,
    source: options.source || "generated",
    variants
  };
}

function variantHueOffsets(count: number): number[] {
  const base = [0, 26, -24, 48, -46, 72, -70, 102, -100, 132, -130, 160];
  return base.slice(0, count);
}

function buildPaletteVariant(input: {
  id: string;
  relationship: string;
  hueFamily: string;
  hue: number;
  index: number;
}): PaletteVariant {
  const relationship = RELATIONSHIPS[input.relationship];
  const tokens = tokensForRelationship(input.relationship, input.hue);
  const checks = validatePalette(tokens);
  if (checks.failures.length > 0) {
    throw new Error(`Generated invalid palette ${input.id}: ${checks.failures.join("; ")}`);
  }
  return {
    id: input.id,
    name: `${titleCase(input.hueFamily)} ${titleCase(input.relationship.replaceAll("-", " "))}`,
    strategy: input.relationship,
    hue_family: input.hueFamily,
    hue: input.hue,
    tokens,
    palette_relationship: relationship,
    palette_usage: paletteUsage(input.relationship),
    checks
  };
}

function tokensForRelationship(relationship: string, h: number): PaletteTokens {
  if (relationship === "light-editorial-accent") {
    return {
      paper: oklchToHex({ mode: "oklch", l: 0.985, c: 0.012, h: wrapHue(h + 35) }),
      panel: oklchToHex({ mode: "oklch", l: 0.948, c: 0.018, h: wrapHue(h + 24) }),
      ink: oklchToHex({ mode: "oklch", l: 0.18, c: 0.028, h: wrapHue(h + 12) }),
      muted: oklchToHex({ mode: "oklch", l: 0.45, c: 0.035, h: wrapHue(h + 4) }),
      accent: oklchToHex({ mode: "oklch", l: 0.54, c: 0.14, h }),
      accent_strong: oklchToHex({ mode: "oklch", l: 0.43, c: 0.17, h }),
      line: oklchToHex({ mode: "oklch", l: 0.84, c: 0.025, h: wrapHue(h + 12) })
    };
  }
  if (relationship === "gallery-neutral") {
    return {
      paper: oklchToHex({ mode: "oklch", l: 0.965, c: 0.006, h }),
      panel: oklchToHex({ mode: "oklch", l: 0.925, c: 0.008, h }),
      ink: oklchToHex({ mode: "oklch", l: 0.16, c: 0.015, h }),
      muted: oklchToHex({ mode: "oklch", l: 0.47, c: 0.02, h }),
      accent: oklchToHex({ mode: "oklch", l: 0.52, c: 0.09, h }),
      accent_strong: oklchToHex({ mode: "oklch", l: 0.41, c: 0.12, h }),
      line: oklchToHex({ mode: "oklch", l: 0.82, c: 0.01, h })
    };
  }
  if (relationship === "product-clear") {
    return {
      paper: "#FFFFFF",
      panel: oklchToHex({ mode: "oklch", l: 0.972, c: 0.006, h }),
      ink: oklchToHex({ mode: "oklch", l: 0.18, c: 0.02, h }),
      muted: oklchToHex({ mode: "oklch", l: 0.46, c: 0.025, h }),
      accent: oklchToHex({ mode: "oklch", l: 0.55, c: 0.16, h }),
      accent_strong: oklchToHex({ mode: "oklch", l: 0.43, c: 0.19, h }),
      line: oklchToHex({ mode: "oklch", l: 0.86, c: 0.012, h })
    };
  }
  if (relationship === "immersive-chroma") {
    return {
      paper: oklchToHex({ mode: "oklch", l: 0.105, c: 0.04, h }),
      panel: oklchToHex({ mode: "oklch", l: 0.17, c: 0.055, h }),
      ink: oklchToHex({ mode: "oklch", l: 0.97, c: 0.018, h }),
      muted: oklchToHex({ mode: "oklch", l: 0.72, c: 0.045, h }),
      accent: oklchToHex({ mode: "oklch", l: 0.72, c: 0.19, h }),
      accent_strong: oklchToHex({ mode: "oklch", l: 0.62, c: 0.22, h }),
      line: oklchToHex({ mode: "oklch", l: 0.31, c: 0.06, h })
    };
  }
  return {
    paper: oklchToHex({ mode: "oklch", l: 0.115, c: 0.03, h }),
    panel: oklchToHex({ mode: "oklch", l: 0.18, c: 0.04, h }),
    ink: oklchToHex({ mode: "oklch", l: 0.965, c: 0.015, h }),
    muted: oklchToHex({ mode: "oklch", l: 0.70, c: 0.035, h }),
    accent: oklchToHex({ mode: "oklch", l: 0.73, c: 0.16, h }),
    accent_strong: oklchToHex({ mode: "oklch", l: 0.63, c: 0.20, h }),
    line: oklchToHex({ mode: "oklch", l: 0.32, c: 0.05, h })
  };
}

function validatePalette(tokens: PaletteTokens): PaletteVariant["checks"] {
  const requiredPairs: Array<[keyof PaletteTokens, keyof PaletteTokens, number, boolean]> = [
    ["ink", "paper", 4.5, true],
    ["ink", "panel", 4.5, true],
    ["muted", "paper", 3.0, false],
    ["accent", "paper", 3.0, false],
    ["accent", "panel", 3.0, false]
  ];
  const contrast: ContrastCheck[] = requiredPairs.map(([fg, bg, threshold, required]) => {
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    return {
      pair: `${fg}/${bg}`,
      foreground: tokens[fg],
      background: tokens[bg],
      ratio,
      level: ratio >= threshold ? "pass" : required ? "fail" : "warn",
      threshold,
      required
    };
  });
  return {
    contrast,
    warnings: contrast.filter((item) => item.level === "warn").map((item) => `${item.pair} contrast ${item.ratio}:1 is below ${item.threshold}:1`),
    failures: contrast.filter((item) => item.level === "fail").map((item) => `${item.pair} contrast ${item.ratio}:1 is below ${item.threshold}:1`)
  };
}

export function paletteUsage(relationship: string): string {
  if (relationship === "product-clear") return "Use accent for primary actions, active controls, focus rings, and important product states. Keep panels quiet and readable.";
  if (relationship === "immersive-chroma") return "Use accent for focal energy, interactive highlights, and one major callout. Keep body surfaces dark and avoid saturating every section.";
  if (relationship === "gallery-neutral") return "Let imagery and typography lead. Use accent only for current navigation, links, focus states, and one subtle callout.";
  if (relationship === "light-editorial-accent") return "Use accent sparingly for links, pull quotes, focus states, and one primary CTA. Preserve reading comfort and editorial restraint.";
  return "Use accent only for links, focus states, active controls, and one key CTA. Keep the dark base dominant and surfaces low-chroma.";
}

export function cssVarsForPalette(run: PaletteRun, variantId = "variant-1"): string {
  const variant = run.variants.find((item) => item.id === variantId) || run.variants[0];
  if (!variant) throw new Error("Palette run contains no variants");
  const entries = Object.entries(variant.tokens).map(([key, value]) => `  --${key.replaceAll("_", "-")}: ${value};`);
  return `:root {\n${entries.join("\n")}\n}\n`;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}
