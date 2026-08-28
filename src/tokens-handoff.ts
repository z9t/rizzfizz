/**
 * Compact tokens-only handoff payload (no HTML).
 * Used by export --format tokens-handoff and handoff --tokens-only.
 */

import { access, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { cssVarsForPalette } from "./color.js";
import { rankDesignSystems } from "./design-system-taxonomy.js";
import { readJson, writeJson, writeText } from "./io.js";
import type { RiffRun } from "./riff.js";
import type { BuildContract, PaletteRun, PaletteTokens, PaletteVariant } from "./types.js";

export type TokensHandoff = {
  schema: "rizzfizz.tokens-handoff.v1";
  created_at: string;
  run_id: string;
  source: string;
  relationship?: string;
  hue_family?: string;
  design_systems: Array<{ id: string; name: string; confidence: number }>;
  design_system_primary: { id: string; name: string; confidence: number };
  variants: Array<{
    id: string;
    name: string;
    tokens: PaletteTokens;
    relationship?: string;
  }>;
  css_vars_path?: string;
  note: string;
};

export async function writeTokensHandoff(input: string, outPath: string): Promise<TokensHandoff> {
  const { run, runDir, textHint } = await loadPaletteRunFlexible(input);
  const ranked = rankDesignSystems({
    text: textHint,
    paletteRun: run,
    relationship: run.relationship
  });
  const payload: TokensHandoff = {
    schema: "rizzfizz.tokens-handoff.v1",
    created_at: new Date().toISOString(),
    run_id: basename(runDir),
    source: run.source,
    relationship: run.relationship,
    hue_family: run.hue_family,
    design_systems: ranked.map((m) => ({ id: m.id, name: m.name, confidence: m.confidence })),
    design_system_primary: {
      id: ranked[0].id,
      name: ranked[0].name,
      confidence: ranked[0].confidence
    },
    variants: run.variants.map((v) => ({
      id: v.id,
      name: v.name,
      tokens: v.tokens,
      relationship: v.palette_relationship?.relationship
    })),
    note: "Tokens-only handoff — no HTML. Use rizzfizz scrub-md --studio only when an interactive preview is needed."
  };

  const cssPath = join(runDir, "tokens.css");
  if (await exists(cssPath)) {
    payload.css_vars_path = "tokens.css";
  } else {
    await writeText(cssPath, cssVarsForPalette(run));
    payload.css_vars_path = "tokens.css";
  }

  await writeJson(resolve(outPath), payload);
  return payload;
}

/** Load palette-run from run dir, palette-run.json, or riff-run.json. */
export async function loadPaletteRunFlexible(input: string): Promise<{
  run: PaletteRun;
  runDir: string;
  textHint: string;
}> {
  const path = resolve(input);
  if (await isFile(path) && path.endsWith(".json")) {
    const json = await readJson<Record<string, unknown>>(path);
    if (json.schema === "rizzfizz.riff-run.v1") {
      const run = riffRunToPaletteRun(json as unknown as RiffRun);
      return { run, runDir: dirname(path), textHint: run.relationship };
    }
    if (json.schema === "rizzfizz.palette-run.v1" || Array.isArray(json.variants)) {
      return {
        run: json as unknown as PaletteRun,
        runDir: dirname(path),
        textHint: String(json.relationship || "")
      };
    }
    throw new Error(`Unsupported JSON for tokens handoff: ${path}`);
  }

  const palettePath = join(path, "palette-run.json");
  if (!(await exists(palettePath))) {
    throw new Error(`No palette-run.json in ${path}`);
  }
  const run = await readJson<PaletteRun>(palettePath);
  let textHint = run.relationship || "";
  const contractPath = join(path, "build-contract.json");
  if (await exists(contractPath)) {
    try {
      const contract = await readJson<BuildContract>(contractPath);
      textHint = [
        contract.intent?.site_type,
        contract.intent?.content_posture,
        contract.design_system_classification?.primary?.name,
        run.relationship
      ].filter(Boolean).join(" ");
    } catch {
      /* ignore */
    }
  }
  return { run, runDir: path, textHint };
}

export function riffRunToPaletteRun(riff: RiffRun): PaletteRun {
  const variants: PaletteVariant[] = (riff.palettes || []).map((p, i) => ({
    id: p.id || `variant-${i + 1}`,
    name: p.id || `Variant ${i + 1}`,
    strategy: "riff",
    hue_family: "riff",
    hue: 0,
    tokens: p.tokens as PaletteTokens,
    palette_relationship: {
      tone: "neutral",
      accent_usage: "sparse",
      chroma: "controlled",
      contrast: "balanced",
      relationship: "riff"
    },
    palette_usage: "Riff-generated palette version.",
    checks: { contrast: [], warnings: [], failures: [] }
  }));
  return {
    schema: "rizzfizz.palette-run.v1",
    created_at: riff.created_at,
    relationship: "riff",
    hue_family: "riff",
    source: riff.source || "riff",
    variants
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
