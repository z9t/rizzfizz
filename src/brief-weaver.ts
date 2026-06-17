import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { buildBuildContract } from "./contract.js";
import { aEyesIntakeVariants, aEyesVariantTokens, writeAgentBriefs } from "./exports.js";
import { readJson, readText, writeJson, writeText } from "./io.js";
import { buildRunManifest } from "./manifest.js";
import { writePreview } from "./preview.js";
import type { BuildContract, ContrastCheck, PaletteRun, PaletteTokens, PaletteVariant, RawReference } from "./types.js";
import { buildVisualTokensRun } from "./visual.js";

type BriefWeaverImportOptions = {
  input: string;
  out: string;
  preview?: boolean;
};

type BriefWeaverVariant = Record<string, unknown> & {
  id?: string;
  name?: string;
  domain?: string;
  raw_prompt_summary?: string;
  design_direction?: string;
  palette_relationship?: Record<string, unknown>;
  palette_tokens?: Record<string, unknown>;
  palette_usage?: string;
  technology_direction?: Record<string, unknown>;
  layout_guidance?: string;
  typography_guidance?: string;
  motion_guidance?: string;
  avoid_copying?: unknown[];
};

type BriefWeaverProjectBrief = Record<string, unknown> & {
  schemaVersion?: string;
  source_safe?: boolean;
  rizzfizz_import?: Record<string, unknown>;
};

type BriefWeaverImportResult = {
  inputDir: string;
  outDir: string;
  variantIds: string[];
  previewPath: string | null;
};

export async function importBriefWeaverRun(options: BriefWeaverImportOptions): Promise<BriefWeaverImportResult> {
  const inputDir = resolve(options.input);
  const outDir = resolve(options.out);
  const runId = basename(inputDir);

  const variationManifest = await readJson<Record<string, unknown>>(join(inputDir, "variation-manifest.json"));
  const projectBrief = readProjectBrief(
    await readJson<BriefWeaverProjectBrief>(join(inputDir, "project-brief.json")),
    "project-brief.json"
  );
  const handoffBrief = readProjectBrief(
    await readJson<BriefWeaverProjectBrief>(join(inputDir, "handoff", "briefweaver-project-brief.json")),
    "handoff/briefweaver-project-brief.json"
  );
  const sourceSafeDna = await readJson<Record<string, unknown>>(join(inputDir, "scrubbed", "scrubbed-design-dna.json"));
  const neutralMd = await readText(join(inputDir, "scrubbed", "DESIGN-neutral.md"));
  const briefWeaverVariants = readVariants(await readJson<Record<string, unknown>>(join(inputDir, "variants", "variants.json")));
  const briefWeaverPaletteRun = await readJson<Record<string, unknown>>(join(inputDir, "palettes", "palette-run.json"));

  const paletteRun = mapPaletteRun({
    inputDir,
    runId,
    variationManifest,
    briefWeaverPaletteRun,
    briefWeaverVariants
  });
  const rawReference = buildBridgeRawReference(inputDir, runId, variationManifest, projectBrief, handoffBrief);
  const scrubbedText = [neutralMd, ...briefWeaverVariants.map((variant) => stringValue(variant.design_direction))].filter(Boolean).join("\n\n");
  const buildContract = applyBriefWeaverContractHints(
    buildBuildContract({ scrubbedText, paletteRun, rawReference }),
    briefWeaverVariants,
    variationManifest
  );
  const visualTokens = buildVisualTokensRun(paletteRun);
  const runManifest = buildRunManifest({
    outDir,
    paletteRun,
    technologyContext: false
  });
  const importedDna = {
    ...sourceSafeDna,
    imported_from: {
      tool: "brief-weaver",
      run_id: runId,
      source_safe: true,
      copied_private_raw: false,
      contract: "RIZZFIZZ-IMPORT-CONTRACT.md"
    }
  };

  await mkdir(outDir, { recursive: true });
  await writeJson(join(outDir, "raw-reference.json"), rawReference);
  await writeJson(join(outDir, "scrubbed-design-dna.json"), importedDna);
  await writeJson(join(outDir, "build-contract.json"), buildContract);
  await writeJson(join(outDir, "visual-tokens.json"), visualTokens);
  await writeText(join(outDir, "DESIGN-neutral.md"), neutralMd);
  await Promise.all(paletteRun.variants.map(async (variant) => {
    const variantPath = join(inputDir, "variants", `DESIGN-${variant.id}.md`);
    const content = await readText(variantPath);
    await writeText(join(outDir, `DESIGN-${variant.id}.md`), content);
  }));
  await writeJson(join(outDir, "palette-run.json"), paletteRun);
  await writeJson(join(outDir, "variants-palette.json"), aEyesVariantTokens(paletteRun, {
    technologyByVariant: technologyByVariant(briefWeaverVariants)
  }));
  await writeJson(join(outDir, "variants.json"), aEyesIntakeVariants(paletteRun, buildContract));
  await writeJson(join(outDir, "run-manifest.json"), runManifest);
  await writeAgentBriefs(join(outDir, "builder-briefs"), paletteRun, importedDna, runId, undefined, buildContract);

  const previewPath = options.preview === false
    ? null
    : await writePreview({ input: outDir, out: join(outDir, "preview.html") });

  return {
    inputDir,
    outDir,
    variantIds: paletteRun.variants.map((variant) => variant.id),
    previewPath
  };
}

function readProjectBrief(payload: BriefWeaverProjectBrief, label: string): BriefWeaverProjectBrief {
  if (payload.schemaVersion !== "briefweaver.project-brief.v1") {
    throw new Error(`Brief Weaver ${label} must use schemaVersion briefweaver.project-brief.v1`);
  }
  if (payload.source_safe !== true) {
    throw new Error(`Brief Weaver ${label} must be source_safe: true`);
  }
  const importContract = recordValue(payload.rizzfizz_import);
  if (!importContract || stringValue(importContract.input_schema) !== "briefweaver.project-brief.v1") {
    throw new Error(`Brief Weaver ${label} must declare rizzfizz_import.input_schema briefweaver.project-brief.v1`);
  }
  return payload;
}

function readVariants(payload: Record<string, unknown>): BriefWeaverVariant[] {
  const variants = payload.variants;
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error("Brief Weaver variants/variants.json must contain a non-empty variants array");
  }
  return variants.map((variant, index) => {
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
      throw new Error(`Brief Weaver variant ${index + 1} must be an object`);
    }
    return variant as BriefWeaverVariant;
  });
}

function mapPaletteRun(options: {
  inputDir: string;
  runId: string;
  variationManifest: Record<string, unknown>;
  briefWeaverPaletteRun: Record<string, unknown>;
  briefWeaverVariants: BriefWeaverVariant[];
}): PaletteRun {
  const palettes = asRecords(options.briefWeaverPaletteRun.palettes, "palettes/palette-run.json palettes");
  if (palettes.length === 0) {
    throw new Error("Brief Weaver palettes/palette-run.json must contain at least one palette");
  }
  const firstVariant = options.briefWeaverVariants[0];
  const firstPalette = palettes[0];
  return {
    schema: "rizzfizz.palette-run.v1",
    created_at: new Date().toISOString(),
    relationship: strategyForBriefWeaver(firstVariant, options.variationManifest),
    hue_family: stringValue(firstPalette.family) || stringValue(options.briefWeaverPaletteRun.family) || "neutral",
    source: `brief-weaver:${options.runId}`,
    variants: palettes.map((palette, index) => mapPaletteVariant({
      palette,
      briefWeaverVariant: options.briefWeaverVariants.find((variant) => stringValue(variant.id) === stringValue(palette.id))
        || options.briefWeaverVariants[index],
      variationManifest: options.variationManifest
    }))
  };
}

function mapPaletteVariant(options: {
  palette: Record<string, unknown>;
  briefWeaverVariant?: BriefWeaverVariant;
  variationManifest: Record<string, unknown>;
}): PaletteVariant {
  const variant = options.briefWeaverVariant;
  const id = stringValue(options.palette.id) || stringValue(variant?.id) || "variant-1";
  const tokens = mapTokens(recordValue(options.palette.tokens) || variant?.palette_tokens || {});
  const relationship = recordValue(variant?.palette_relationship) || {};
  const contrastChecks = recordValue(relationship.contrast_checks) || recordValue(options.palette.contrast_checks) || {};
  const strategy = strategyForBriefWeaver(variant, options.variationManifest);
  return {
    id,
    name: stringValue(variant?.name) || stringValue(options.palette.name) || titleFromId(id),
    strategy,
    hue_family: stringValue(options.palette.family) || stringValue(relationship.hue_family) || "neutral",
    hue: numberValue(options.palette.hue) ?? numberValue(relationship.hue) ?? 215,
    tokens,
    palette_relationship: {
      tone: toneValue(stringValue(relationship.mode) || stringValue(options.palette.mode)),
      accent_usage: accentUsageValue(stringValue(relationship.accent_usage)),
      chroma: chromaValue(stringValue(relationship.relationship)),
      contrast: "Brief Weaver contrast checks mapped to RizzFizz token roles.",
      relationship: stringValue(relationship.relationship) || `${strategy} imported from Brief Weaver`
    },
    palette_usage: stringValue(variant?.palette_usage) || "Use accent tokens sparingly and preserve the imported palette role relationships.",
    checks: {
      contrast: mapContrastChecks(tokens, contrastChecks),
      warnings: [],
      failures: []
    }
  };
}

function mapTokens(source: Record<string, unknown>): PaletteTokens {
  return {
    paper: hexValue(source.background) || hexValue(source.paper) || "#0A0A0A",
    panel: hexValue(source.surface) || hexValue(source.panel) || "#171717",
    ink: hexValue(source.text) || hexValue(source.ink) || "#F5F5F5",
    muted: hexValue(source.muted_text) || hexValue(source.muted) || "#A3A3A3",
    accent: hexValue(source.accent) || "#6EA8FF",
    accent_strong: hexValue(source.primary) || hexValue(source.accent_strong) || hexValue(source.accent) || "#A8CBFF",
    line: hexValue(source.border) || hexValue(source.line) || "#333333"
  };
}

function mapContrastChecks(tokens: PaletteTokens, checks: Record<string, unknown>): ContrastCheck[] {
  return [
    contrastCheck("ink/paper", tokens.ink, tokens.paper, numberValue(checks.text_on_background), 4.5, true),
    contrastCheck("ink/panel", tokens.ink, tokens.panel, numberValue(checks.text_on_surface), 4.5, true),
    contrastCheck("muted/paper", tokens.muted, tokens.paper, numberValue(checks.muted_text_on_background), 3, false),
    contrastCheck("accent_strong/paper", tokens.accent_strong, tokens.paper, numberValue(checks.primary_on_background), 3, false),
    contrastCheck("accent/paper", tokens.accent, tokens.paper, numberValue(checks.accent_on_background), 3, false),
    contrastCheck("accent/panel", tokens.accent, tokens.panel, numberValue(checks.accent_on_surface), 3, false)
  ];
}

function contrastCheck(
  pair: string,
  foreground: string,
  background: string,
  ratio: number | undefined,
  threshold: number,
  required: boolean
): ContrastCheck {
  const value = ratio ?? 0;
  return {
    pair,
    foreground,
    background,
    ratio: value,
    level: value >= threshold ? "pass" : required ? "fail" : "warn",
    threshold,
    required
  };
}

function buildBridgeRawReference(
  inputDir: string,
  runId: string,
  variationManifest: Record<string, unknown>,
  projectBrief: BriefWeaverProjectBrief,
  handoffBrief: BriefWeaverProjectBrief
): RawReference {
  return {
    schema: "rizzfizz.raw-reference.v1",
    source_type: "design-md",
    source_locator: `brief-weaver:${runId}`,
    captured_at: new Date().toISOString(),
    private_notes: "Bridge provenance only. Brief Weaver raw/ and source-manifest.json are not copied into source-safe RizzFizz artifacts.",
    raw_text: "",
    extracted: {
      urls: [],
      hex_colors: [],
      possible_fonts: [],
      possible_identity_terms: []
    },
    provenance: {
      tool: "brief-weaver",
      source_run: inputDir,
      project_brief: join(inputDir, "project-brief.json"),
      handoff_project_brief: join(inputDir, "handoff", "briefweaver-project-brief.json"),
      source_manifest: join(inputDir, "source-manifest.json"),
      raw_dir: join(inputDir, "raw"),
      copied_private_raw: false,
      import_contract: {
        status: stringValue(recordValue(projectBrief.rizzfizz_import)?.status),
        input_schema: stringValue(recordValue(projectBrief.rizzfizz_import)?.input_schema),
        handoff_input_schema: stringValue(recordValue(handoffBrief.rizzfizz_import)?.input_schema)
      },
      variation_manifest: {
        run_id: stringValue(variationManifest.run_id),
        domain: stringValue(variationManifest.domain),
        variant_count: numberValue(variationManifest.variant_count)
      }
    }
  };
}

function applyBriefWeaverContractHints(
  contract: BuildContract,
  variants: BriefWeaverVariant[],
  variationManifest: Record<string, unknown>
): BuildContract {
  const first = variants[0];
  const domain = stringValue(first?.domain) || stringValue(variationManifest.domain);
  const promptSummary = stringValue(first?.raw_prompt_summary);
  return {
    ...contract,
    intent: {
      ...contract.intent,
      site_type: domain || contract.intent.site_type,
      primary_job: stringValue(first?.design_direction) || contract.intent.primary_job,
      content_posture: promptSummary || contract.intent.content_posture
    },
    avoid: [
      ...contract.avoid,
      ...unique(variants.flatMap((variant) => (Array.isArray(variant.avoid_copying) ? variant.avoid_copying.map(String) : [])))
        .map((item) => `Brief Weaver avoid: ${item}.`)
    ],
    variants: contract.variants.map((contractVariant) => {
      const sourceVariant = variants.find((variant) => stringValue(variant.id) === contractVariant.id);
      const hints = [
        stringValue(sourceVariant?.layout_guidance),
        stringValue(sourceVariant?.typography_guidance),
        stringValue(sourceVariant?.motion_guidance),
        ...(Array.isArray(sourceVariant?.avoid_copying) ? sourceVariant.avoid_copying.map((item) => `Avoid copying ${String(item)}.`) : [])
      ].filter(Boolean);
      return {
        ...contractVariant,
        technology_direction: recordValue(sourceVariant?.technology_direction) || contractVariant.technology_direction,
        visual_rules: [...contractVariant.visual_rules, ...hints]
      };
    })
  };
}

function technologyByVariant(variants: BriefWeaverVariant[]): Map<string, Record<string, unknown>> {
  return new Map(variants.flatMap((variant) => {
    const id = stringValue(variant.id);
    const technology = recordValue(variant.technology_direction);
    return id && technology ? [[id, technology] as const] : [];
  }));
}

function strategyForBriefWeaver(variant: BriefWeaverVariant | undefined, manifest: Record<string, unknown>): string {
  const text = [
    stringValue(variant?.domain),
    stringValue(manifest.domain),
    stringValue(variant?.design_direction),
    stringValue(variant?.raw_prompt_summary)
  ].join(" ").toLowerCase();
  if (/\b(product|saas|dashboard|app|workflow)\b/.test(text)) return "product-clear";
  if (/\b(editorial|publication|documentation|article|reading)\b/.test(text)) return "light-editorial-accent";
  if (/\b(immersive|webgl|3d|cinematic)\b/.test(text)) return "immersive-chroma";
  if (/\b(photo|photography|portfolio|gallery|image)\b/.test(text)) return "gallery-neutral";
  return "dark-sparse-accent";
}

function accentUsageValue(value: string): "sparse" | "moderate" | "expressive" {
  const lower = value.toLowerCase();
  if (/expressive|high|signature|bold/.test(lower)) return "expressive";
  if (/moderate|balanced/.test(lower)) return "moderate";
  return "sparse";
}

function toneValue(value: string): "dark" | "light" | "neutral" {
  const lower = value.toLowerCase();
  if (lower === "light") return "light";
  if (lower === "neutral") return "neutral";
  return "dark";
}

function chromaValue(value: string): string {
  if (/low-chroma|low chroma/i.test(value)) return "low-chroma";
  if (/high-chroma|high chroma/i.test(value)) return "high-chroma accent on controlled neutrals";
  return "controlled chroma";
}

function asRecords(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label}[${index}] must be an object`);
    return item as Record<string, unknown>;
  });
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function hexValue(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : undefined;
}

function titleFromId(id: string): string {
  return id.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
