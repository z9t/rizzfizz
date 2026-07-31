/**
 * designmd.ts — Emit Google DESIGN.md spec-compliant output from a RizzFizz PaletteRun.
 *
 * Conforms to: https://github.com/google-labs-code/design.md
 * Spec: YAML frontmatter (colors, typography, spacing) + sectioned markdown body.
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { PaletteRun, PaletteTokens, PaletteRelationship } from "./types.js";
import { paletteRunSchema } from "./schemas.js";
import { readJson, writeText } from "./io.js";

// ── Token mapping ──────────────────────────────────────────────────

const COLOR_TOKEN_MAP: Record<keyof PaletteTokens, string> = {
  paper: "surface",
  panel: "surface-container",
  ink: "on-surface",
  muted: "outline",
  accent: "primary",
  accent_strong: "primary-container",
  line: "outline-variant",
};

type TypographyLevel = {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number | string;
  letterSpacing?: string;
};

const DEFAULT_TYPOGRAPHY: Record<string, TypographyLevel> = {
  "display-lg": { fontFamily: "Inter", fontSize: "56px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" },
  "headline-md": { fontFamily: "Inter", fontSize: "36px", fontWeight: 600, lineHeight: 1.2 },
  "title-md": { fontFamily: "Inter", fontSize: "24px", fontWeight: 500, lineHeight: 1.3 },
  "body-lg": { fontFamily: "Inter", fontSize: "18px", fontWeight: 400, lineHeight: 1.6 },
  "body-md": { fontFamily: "Inter", fontSize: "16px", fontWeight: 400, lineHeight: 1.6 },
  "label-md": { fontFamily: "Inter", fontSize: "14px", fontWeight: 500, lineHeight: 1.4, letterSpacing: "0.01em" },
  "caption-sm": { fontFamily: "Inter", fontSize: "12px", fontWeight: 400, lineHeight: 1.3 },
};

// ── Emit DESIGN.md ─────────────────────────────────────────────────

export function emitDesignMd(
  run: PaletteRun,
  options: {
    name?: string;
    description?: string;
    variantIndex?: number; // 0 = neutral, 1+ = variant-N
    scrubbedProse?: string;
    techContext?: string;
  } = {}
): string {
  // For neutral, use first variant's tokens; otherwise use specific variant
  const idx = options.variantIndex ?? 0;
  const variant = run.variants[Math.max(0, Math.min(idx, run.variants.length - 1))] ?? null;
  const tokens = variant?.tokens ?? null;
  const relationship = variant?.palette_relationship ?? null;

  const name = options.name || displayNameFromSource(run.source);
  const description = options.description || defaultDescription(run);

  const lines: string[] = [];

  // ── YAML frontmatter ──────────────────────────────────────────
  lines.push("---");
  lines.push(`name: ${yamlString(name)}`);
  if (description) lines.push(`description: ${yamlString(description)}`);
  lines.push("");

  // Colors
  if (tokens) {
    lines.push("colors:");
    for (const [rizzKey, hex] of Object.entries(tokens)) {
      const specKey = COLOR_TOKEN_MAP[rizzKey as keyof PaletteTokens] || rizzKey;
      lines.push(`  ${specKey}: "${hex}"`);
    }
    lines.push("");
  }

  // Typography
  lines.push("typography:");
  for (const [level, props] of Object.entries(DEFAULT_TYPOGRAPHY)) {
    lines.push(`  ${level}:`);
    lines.push(`    fontFamily: ${yamlString(props.fontFamily)}`);
    lines.push(`    fontSize: ${props.fontSize}`);
    lines.push(`    fontWeight: ${props.fontWeight}`);
    if (props.lineHeight) {
      if (typeof props.lineHeight === "number" && props.lineHeight >= 1) {
        lines.push(`    lineHeight: ${props.lineHeight}`);
      } else {
        lines.push(`    lineHeight: "${props.lineHeight}"`);
      }
    }
    if (props.letterSpacing) {
      lines.push(`    letterSpacing: "${props.letterSpacing}"`);
    }
  }
  lines.push("");

  // Spacing
  lines.push("spacing:");
  lines.push('  xs: "4px"');
  lines.push('  sm: "8px"');
  lines.push('  md: "16px"');
  lines.push('  lg: "24px"');
  lines.push('  xl: "32px"');
  lines.push('  "2xl": "48px"');
  lines.push('  "3xl": "64px"');
  lines.push("");

  // Rounded
  lines.push("rounded:");
  lines.push('  sm: "4px"');
  lines.push('  md: "8px"');
  lines.push('  lg: "12px"');
  lines.push('  xl: "16px"');
  lines.push('  full: "9999px"');
  lines.push("");

  // Components (minimal)
  lines.push("components:");
  lines.push("  button:");
  lines.push("    backgroundColor: \"{colors.primary}\"");
  lines.push("    textColor: \"{colors.on-surface}\"");
  lines.push("    rounded: \"{rounded.md}\"");
  lines.push("    padding: \"{spacing.sm} {spacing.lg}\"");
  lines.push("    typography: \"{typography.label-md}\"");
  lines.push("  card:");
  lines.push("    backgroundColor: \"{colors.surface-container}\"");
  lines.push("    rounded: \"{rounded.lg}\"");
  lines.push("    padding: \"{spacing.lg}\"");
  lines.push("");

  lines.push("---");
  lines.push("");

  // ── Markdown body ──────────────────────────────────────────────
  lines.push(`# ${name}`);
  lines.push("");

  // Overview
  lines.push("## Overview");
  lines.push("");
  if (options.scrubbedProse) {
    lines.push(options.scrubbedProse);
  } else {
    lines.push(`${name} is a design system with a ${relationship?.tone || "neutral"} tone and ${relationship?.accent_usage || "sparse"} accent usage.`);
    if (relationship) {
      lines.push(`The palette uses a ${relationship.chroma} chroma range with ${relationship.contrast} contrast.`);
    }
  }
  lines.push("");

  // Colors
  lines.push("## Colors");
  lines.push("");
  if (tokens) {
    lines.push("The palette is rooted in a balanced hierarchy of surface, content, and interaction colors.");
    lines.push("");
    for (const [rizzKey, hex] of Object.entries(tokens)) {
      const specKey = COLOR_TOKEN_MAP[rizzKey as keyof PaletteTokens] || rizzKey;
      const label = specKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`- **${label} (${hex}):** {colors.${specKey}}`);
    }
  }
  lines.push("");

  // Typography
  lines.push("## Typography");
  lines.push("");
  lines.push("The typography system uses a clean geometric sans-serif at seven scales for clear hierarchy.");
  lines.push("");

  // Layout
  lines.push("## Layout");
  lines.push("");
  lines.push("The layout follows a responsive grid with the spacing scale. Use `{spacing.lg}` for section gutters and `{spacing.md}` for component padding.");
  lines.push("");

  // Elevation
  lines.push("## Elevation & Depth");
  lines.push("");
  lines.push("Depth is conveyed through surface container hierarchy and subtle shadows. Prefer elevation over borders for visual separation.");
  lines.push("");

  // Shapes
  lines.push("## Shapes");
  lines.push("");
  lines.push("Components use rounded corners from the rounded scale. Interactive elements use `{rounded.md}`, containers use `{rounded.lg}`.");
  lines.push("");

  // Do's and Don'ts
  lines.push("## Do's and Don'ts");
  lines.push("");
  lines.push("- **Do** use `{colors.primary}` for primary actions and interactive states.");
  lines.push("- **Do** maintain `{spacing.lg}` minimum between unrelated sections.");
  lines.push("- **Don't** use `{colors.primary}` for non-interactive text.");
  lines.push("- **Don't** mix rounded values outside the defined scale.");

  if (options.techContext) {
    lines.push("");
    lines.push("## Technology Context");
    lines.push("");
    lines.push(options.techContext);
  }

  return lines.join("\n") + "\n";
}

// ── Export all variants ───────────────────────────────────────────

export interface DesignMdExportOptions {
  input: string;    // run directory
  out: string;      // output directory
  name?: string;
  description?: string;
  techContext?: string;
}

export async function exportDesignMd(options: DesignMdExportOptions): Promise<string[]> {
  const paletteRunPath = join(options.input, "palette-run.json");
  const run = paletteRunSchema.parse(await readJson(paletteRunPath)) as PaletteRun;
  const scrubbedProse = await readScrubbedProse(options.input);

  const paths: string[] = [];

  // Neutral
  const neutralMd = emitDesignMd(run, {
    name: options.name || "Design System Neutral",
    description: options.description,
    scrubbedProse,
    techContext: options.techContext,
  });
  const neutralPath = join(options.out, "DESIGN.md");
  await writeText(neutralPath, neutralMd);
  paths.push(neutralPath);

  // Per-variant
  for (let i = 0; i < run.variants.length; i++) {
    const variant = run.variants[i];
    const variantMd = emitDesignMd(run, {
      name: options.name || variant.name,
      description: `Variant ${variant.id}: ${variant.strategy}. Hue: ${variant.hue_family}.`,
      variantIndex: i,
      techContext: options.techContext,
    });
    const id = variant.id.replace(/^variant-/, "");
    const variantPath = join(options.out, `DESIGN-variant-${id}.md`);
    await writeText(variantPath, variantMd);
    paths.push(variantPath);
  }

  return paths;
}

// ── Helpers ────────────────────────────────────────────────────────

async function readScrubbedProse(inputDir: string): Promise<string> {
  const candidates = [
    join(inputDir, "DESIGN-neutral.md"),
    join(inputDir, "scrubbed", "DESIGN-neutral.md")
  ];
  for (const path of candidates) {
    try {
      const raw = await readFile(path, "utf-8");
      return raw
        .replace(/^#.*$/gm, "")
        .replace(/^##\s+(Preserved|Source-Safe|Scrubbed|Palette|Builder|Constraints).*$/gim, "")
        .replace(/^---.*$/gm, "")
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } catch {
      // try next candidate
    }
  }
  return "";
}

function displayNameFromSource(source: string | undefined): string {
  if (!source) return "Design System";
  if (source.startsWith("design-md:")) {
    const stem = source.slice("design-md:".length).replace(/\.[^.]+$/, "");
    return stem || "Design System";
  }
  if (source.startsWith("/") || source.includes("\\") || source.includes("/")) {
    return "Design System";
  }
  return source;
}

function defaultDescription(run: PaletteRun): string {
  return `Generated by RizzFizz (${run.relationship}, ${run.hue_family}).`;
}

function yamlString(s: string): string {
  if (!s) return '""';
  if (/[:"{}[\],&*#?|>%@`!\-<>=]/.test(s) || s.includes("'") || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
