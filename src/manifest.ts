import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readJson } from "./io.js";
import type { BuildContract, PaletteRun, RunManifest, VisualTokensRun } from "./types.js";

export function buildRunManifest(options: {
  outDir: string;
  paletteRun: PaletteRun;
  technologyContext: boolean;
  designScore?: boolean;
  createdAt?: string;
}): RunManifest {
  const outDir = resolve(options.outDir);
  return {
    schema: "rizzfizz.run-manifest.v1",
    created_at: options.createdAt || new Date().toISOString(),
    source_safe_entrypoints: {
      build_contract: join(outDir, "build-contract.json"),
      visual_tokens: join(outDir, "visual-tokens.json"),
      palette_run: join(outDir, "palette-run.json"),
      variants_palette: join(outDir, "variants-palette.json"),
      variants_json: join(outDir, "variants.json"),
      preview_html: join(outDir, "preview.html"),
      tokens_css: join(outDir, "tokens.css"),
      builder_briefs: join(outDir, "builder-briefs")
    },
    private_artifacts: {
      raw_reference: join(outDir, "raw-reference.json")
    },
    optional_artifacts: {
      technology_context: options.technologyContext ? join(outDir, "technology-context.json") : null,
      design_score: options.designScore === false ? null : join(outDir, "design-score.json")
    },
    recommended_start: join(outDir, "build-contract.json"),
    variants: options.paletteRun.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      builder_brief: join(outDir, "builder-briefs", `${variant.id}.md`),
      design_md: join(outDir, `DESIGN-${variant.id}.md`)
    }))
  };
}

export async function inspectRun(inputDir: string): Promise<string> {
  const dir = resolve(inputDir);
  const manifest = await readJson<RunManifest>(join(dir, "run-manifest.json"));
  const contract = await readJson<BuildContract>(manifest.source_safe_entrypoints.build_contract);
  const visual = await readJson<VisualTokensRun>(manifest.source_safe_entrypoints.visual_tokens);
  const hasTech = manifest.optional_artifacts.technology_context
    ? await exists(manifest.optional_artifacts.technology_context)
    : false;
  return [
    `RizzFizz run: ${dir}`,
    `Recommended start: ${manifest.recommended_start}`,
    `Site type: ${contract.intent.site_type}`,
    `Primary job: ${contract.intent.primary_job}`,
    `Design system: ${contract.design_system_classification.primary.name} (${contract.design_system_classification.primary.confidence_label})`,
    `Variants: ${manifest.variants.map((item) => item.id).join(", ")}`,
    `Visual token variants: ${visual.variants.length}`,
    `Motion level: ${contract.motion.level}`,
    `Technology context: ${hasTech ? "present" : "not present"}`,
    `Private raw reference: ${manifest.private_artifacts.raw_reference}`
  ].join("\n");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
