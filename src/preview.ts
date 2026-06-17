import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readJson, writeText } from "./io.js";
import type { BuildContract, BuildContractVariant, DesignScoreVariantGuidance, PaletteRun, PaletteVariant, RunManifest, VisualTokensRun, VisualTokensVariant } from "./types.js";
import type { TechnologyContext } from "./technology.js";

type PreviewOptions = {
  input: string;
  out: string;
};

export async function writePreview(options: PreviewOptions): Promise<string> {
  const inputDir = resolve(options.input);
  const outPath = resolve(options.out);
  const manifest = await readJson<RunManifest>(join(inputDir, "run-manifest.json"));
  const contract = await readJson<BuildContract>(manifest.source_safe_entrypoints.build_contract);
  const paletteRun = await readJson<PaletteRun>(manifest.source_safe_entrypoints.palette_run);
  const visualTokens = await readJson<VisualTokensRun>(manifest.source_safe_entrypoints.visual_tokens);
  const technologyContext = manifest.optional_artifacts.technology_context && await exists(manifest.optional_artifacts.technology_context)
    ? await readJson<TechnologyContext>(manifest.optional_artifacts.technology_context)
    : undefined;
  const designScoreGuidance = manifest.optional_artifacts.design_score && await exists(manifest.optional_artifacts.design_score)
    ? designScoreGuidanceFromReport(await readJson<Record<string, unknown>>(manifest.optional_artifacts.design_score))
    : undefined;

  await writeText(outPath, renderPreview({ inputDir, manifest, contract, paletteRun, visualTokens, technologyContext, designScoreGuidance }));
  return outPath;
}

function renderPreview(options: {
  inputDir: string;
  manifest: RunManifest;
  contract: BuildContract;
  paletteRun: PaletteRun;
  visualTokens: VisualTokensRun;
  technologyContext?: TechnologyContext;
  designScoreGuidance?: DesignScoreVariantGuidance;
}): string {
  const { inputDir, manifest, contract, paletteRun, visualTokens, technologyContext, designScoreGuidance } = options;
  const variants = paletteRun.variants.map((variant) => {
    const contractVariant = contract.variants.find((item) => item.id === variant.id);
    const visualVariant = visualTokens.variants.find((item) => item.id === variant.id);
    return variantSection(variant, contractVariant, visualVariant, contract, technologyContext, designScoreGuidance);
  }).join("\n");
  const technologySummary = technologyContext ? technologyContextSection(technologyContext) : "";
  const designSystemSummary = designSystemSection(contract);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RizzFizz Preview - ${escapeHtml(inputDir)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f6f7f8;
      --paper: #ffffff;
      --ink: #17191c;
      --muted: #5d6673;
      --line: #d9dde3;
      --accent: #2457c5;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.5;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    h1, h2, h3 { line-height: 1.1; margin: 0; letter-spacing: 0; }
    h1 { font-size: clamp(2rem, 5vw, 4rem); max-width: 860px; }
    h2 { font-size: 1.6rem; }
    h3 { font-size: 1rem; }
    p { margin: 0; }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }
    .meta div, .variant, .contract-block {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .meta div { padding: 14px 16px; }
    .label {
      color: var(--muted);
      display: block;
      font-size: 0.78rem;
      font-weight: 700;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .variants {
      display: grid;
      gap: 18px;
    }
    .technology-context {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      gap: 14px;
      margin-bottom: 18px;
      padding: 18px;
    }
    .technology-context .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .evidence-list {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .evidence-item {
      border-left: 3px solid var(--accent);
      color: var(--muted);
      padding-left: 10px;
    }
    .variant { overflow: hidden; }
    .variant-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      padding: 18px;
      border-bottom: 1px solid var(--line);
    }
    .variant-id {
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.85rem;
    }
    .tone {
      align-self: start;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      padding: 5px 10px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .variant-body {
      display: grid;
      grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.4fr);
      gap: 18px;
      padding: 18px;
    }
    .swatches {
      display: grid;
      gap: 8px;
    }
    .swatch {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
      background: var(--paper);
    }
    .chip { border-right: 1px solid var(--line); }
    .swatch span:last-child {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      padding: 8px 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.82rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .contract-block { padding: 14px; }
    .contract-block p, .contract-block li { color: var(--muted); }
    ul {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    code {
      background: color-mix(in srgb, var(--line), transparent 55%);
      border-radius: 4px;
      padding: 1px 4px;
    }
    .footer-note {
      color: var(--muted);
      margin-top: 24px;
      font-size: 0.92rem;
    }
    @media (max-width: 780px) {
      main { width: min(100% - 24px, 1180px); padding-top: 20px; }
      .variant-head, .variant-body, .grid { grid-template-columns: 1fr; }
      .tone { justify-self: start; }
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #101114;
        --paper: #17191d;
        --ink: #f4f6f8;
        --muted: #a8b0bc;
        --line: #303640;
        --accent: #7ca5ff;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="label">RizzFizz static run preview</span>
      <h1>${escapeHtml(contract.intent.site_type)}</h1>
      <div class="meta">
        <div><span class="label">Run</span>${escapeHtml(inputDir)}</div>
        <div><span class="label">Primary job</span>${escapeHtml(contract.intent.primary_job)}</div>
        <div><span class="label">Design system</span>${escapeHtml(contract.design_system_classification.primary.name)} (${escapeHtml(contract.design_system_classification.primary.confidence_label)})</div>
        <div><span class="label">Recommended start</span><code>${escapeHtml(manifest.recommended_start)}</code></div>
        <div><span class="label">a-eyes handoff</span><code>${escapeHtml(manifest.source_safe_entrypoints.variants_palette)}</code></div>
      </div>
    </header>
    <section class="variants" aria-label="Variant previews">
      ${designSystemSummary}
      ${technologySummary}
      ${variants}
    </section>
    <p class="footer-note">Use this page for human variant selection before handing a selected variant's <code>palette_tokens</code>, <code>palette_relationship</code>, <code>palette_usage</code>, <code>technology_direction</code>, and builder brief to the a-eyes builder flow. The page is generated only from source-safe artifacts.</p>
  </main>
</body>
</html>
`;
}

function variantSection(
  variant: PaletteVariant,
  contractVariant: BuildContractVariant | undefined,
  visualVariant: VisualTokensVariant | undefined,
  contract: BuildContract,
  technologyContext?: TechnologyContext,
  designScoreGuidance?: DesignScoreVariantGuidance
): string {
  const stackFit = technologyContext
    ? `<li>Stack fit: ${escapeHtml(technologyContext.recommendations.stack_fit)}</li>
          <li>Strongest source evidence: ${escapeHtml(compactEvidenceLabel(technologyContext))}</li>
          <li>Do not clone: ${escapeHtml((technologyContext.recommendations.do_not_clone || [])[0] || "source-specific implementation details")}</li>`
    : "";
  return `<article class="variant" id="${escapeAttribute(variant.id)}">
  <div class="variant-head">
    <div>
      <span class="variant-id">${escapeHtml(variant.id)}</span>
      <h2>${escapeHtml(variant.name)}</h2>
      <p>${escapeHtml(variant.palette_relationship.relationship)}</p>
    </div>
    <span class="tone">${escapeHtml(variant.palette_relationship.tone)} / ${escapeHtml(variant.palette_relationship.accent_usage)}</span>
  </div>
  <div class="variant-body">
    <section>
      <h3>Palette</h3>
      <div class="swatches" aria-label="${escapeAttribute(variant.name)} palette">
        ${Object.entries(variant.tokens).map(([name, value]) => swatch(name, value)).join("\n")}
      </div>
    </section>
    <section class="grid">
      <div class="contract-block">
        <h3>Typography Direction</h3>
        <p>Premium role-based heading and body pairing. Preserve hierarchy, rhythm, and readability without copying proprietary font identity.</p>
      </div>
      <div class="contract-block">
        <h3>Layout Intent</h3>
        <p>${escapeHtml(contract.layout.first_viewport)}</p>
        <ul>${contract.layout.regions.map((region) => `<li>${escapeHtml(region.id)}: ${escapeHtml(region.purpose)} (${escapeHtml(region.density)})</li>`).join("")}</ul>
      </div>
      <div class="contract-block">
        <h3>Motion Notes</h3>
        <p>Level: ${escapeHtml(contract.motion.level)}. ${escapeHtml(contract.motion.reduced_motion)}</p>
        <ul>${contract.motion.patterns.map((pattern) => `<li>${escapeHtml(pattern.name)}: ${pattern.duration_ms[0]}-${pattern.duration_ms[1]}ms, ${escapeHtml(pattern.easing)}</li>`).join("")}</ul>
      </div>
      <div class="contract-block">
        <h3>Design System Quality</h3>
        <p>${escapeHtml(contract.design_system_classification.primary.name)}: ${escapeHtml(contract.design_system_classification.primary.summary || contract.design_system_classification.primary.qualities.grid_behavior)}</p>
        <ul>
          <li>Grid: ${escapeHtml(contract.design_system_classification.primary.qualities.grid_behavior)}</li>
          <li>Entropy: ${escapeHtml(contract.design_system_classification.primary.qualities.entropy)}</li>
          <li>Tokens: ${escapeHtml(contract.design_system_classification.primary.qualities.token_usage)}</li>
        </ul>
      </div>
      <div class="contract-block">
        <h3>Key Contract Details</h3>
        <ul>
          <li>Palette usage: ${escapeHtml(variant.palette_usage)}</li>
          <li>Technology: ${escapeHtml(String(contractVariant?.technology_direction.stack || "source-safe builder choice"))}</li>
          ${stackFit}
          <li>Focus ring: ${escapeHtml(visualVariant?.actions.focus_ring || variant.tokens.accent)}</li>
          <li>Visual rules: ${escapeHtml((contractVariant?.visual_rules || []).join(" "))}</li>
        </ul>
      </div>
      ${designScoreGuidance ? designScoreBlock(designScoreGuidance) : ""}
    </section>
  </div>
</article>`;
}

function designSystemSection(contract: BuildContract): string {
  const classification = contract.design_system_classification;
  const secondary = classification.secondary
    ? `<p>Secondary signal: ${escapeHtml(classification.secondary.name)} (${escapeHtml(classification.secondary.confidence_label)}).</p>`
    : "";
  return `<section class="technology-context" aria-label="Design system quality classification">
    <div>
      <span class="label">Design system quality classification</span>
      <h2>${escapeHtml(classification.primary.name)}</h2>
      <p>${escapeHtml(classification.primary.qualities.grid_behavior)} ${escapeHtml(classification.primary.qualities.hierarchy)}</p>
      ${secondary}
    </div>
    <div class="grid">
      <div class="contract-block">
        <h3>Matched Qualities</h3>
        <ul>${classification.matched_qualities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="contract-block">
        <h3>Programmatic Qualities</h3>
        <ul>
          <li>Logical unit: ${escapeHtml(classification.primary.qualities.logical_unit)}</li>
          <li>Density: ${escapeHtml(classification.primary.qualities.density)}</li>
          <li>Typography: ${escapeHtml(classification.primary.qualities.typography)}</li>
          <li>Token usage: ${escapeHtml(classification.primary.qualities.token_usage)}</li>
        </ul>
      </div>
      <div class="contract-block">
        <h3>Source-Safe Evidence</h3>
        <ul>${classification.source_safe_evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>
  </section>`;
}

function designScoreBlock(guidance: DesignScoreVariantGuidance): string {
  return `<div class="contract-block">
        <h3>Design Score Guidance</h3>
        <p>${escapeHtml(guidance.report_card.grade)} (${guidance.report_card.score}/100): ${escapeHtml(guidance.report_card.summary)}</p>
        <ul>
          <li>Palette: ${escapeHtml(guidance.palette_constraints.slice(0, 2).join(" "))}</li>
          <li>Locked archetype: ${escapeHtml(guidance.archetype_constraints.locked.slice(0, 3).join("; "))}</li>
          <li>May vary safely: ${escapeHtml(guidance.archetype_constraints.may_vary.slice(0, 3).join("; "))}</li>
          <li>Verify: ${escapeHtml(guidance.qa_checks.slice(0, 2).join(" "))}</li>
          <li>Do not clone: ${escapeHtml(guidance.do_not_clone.slice(0, 2).join(" "))}</li>
        </ul>
      </div>`;
}

function technologyContextSection(technologyContext: TechnologyContext): string {
  const top = technologyContext.detected.slice(0, 4);
  const doNotClone = technologyContext.recommendations.do_not_clone || [];
  const evidence = top.flatMap((item) => (item.strongest_evidence || []).slice(0, 1).map((entry) => (
    `${item.name} ${item.confidence}%: ${entry.channel} evidence, pattern ${entry.pattern || "n/a"}, value kind ${entry.value_kind || "n/a"}`
  )));
  return `<section class="technology-context" aria-label="Source technology context">
    <div>
      <span class="label">Source technology context</span>
      <h2>Stack Fit Evidence</h2>
      <p>${escapeHtml(technologyContext.recommendations.detected_stack_summary)}</p>
    </div>
    <div class="grid">
      <div class="contract-block">
        <h3>Why This Stack</h3>
        <p>${escapeHtml(technologyContext.recommendations.stack_fit)}</p>
      </div>
      <div class="contract-block">
        <h3>Strongest Evidence</h3>
        <div class="evidence-list">${evidence.map((item) => `<p class="evidence-item">${escapeHtml(item)}</p>`).join("") || "<p>No confident technology evidence promoted.</p>"}</div>
      </div>
      <div class="contract-block">
        <h3>Do Not Clone</h3>
        <ul>${doNotClone.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>
  </section>`;
}

function compactEvidenceLabel(technologyContext: TechnologyContext): string {
  const tech = technologyContext.detected[0];
  const evidence = tech?.strongest_evidence?.[0];
  if (!tech || !evidence) return "no promoted evidence";
  return `${tech.name} ${tech.confidence}% via ${evidence.channel}/${evidence.pattern || "pattern unavailable"}`;
}

function designScoreGuidanceFromReport(report: Record<string, unknown>): DesignScoreVariantGuidance | undefined {
  if (report.schema !== "rizzfizz.design-score-report.v1" || report.source_safe !== true) return undefined;
  const reportCard = recordValue(report.report_card) || {};
  const exportable = recordValue(recordValue(report.exportable_guidance)?.json) || {};
  const safeConstraints = recordValue(report.safe_variation_constraints) || {};
  const archetypeConstraints = recordValue(exportable.archetype_constraints) || {};
  return {
    source: "design-score-report",
    report_card: {
      score: typeof reportCard.score === "number" ? reportCard.score : 0,
      grade: stringValue(reportCard.grade) || "n/a",
      summary: stringValue(reportCard.summary)
    },
    palette_constraints: stringArray(exportable.palette_constraints),
    archetype_constraints: {
      locked: stringArray(archetypeConstraints.locked).concat(stringArray(safeConstraints.locked)).filter(uniqueFilter),
      may_vary: stringArray(archetypeConstraints.may_vary).concat(stringArray(safeConstraints.may_vary)).filter(uniqueFilter),
      verify: stringArray(archetypeConstraints.verify).concat(stringArray(safeConstraints.verify)).filter(uniqueFilter)
    },
    combined_guidance: stringArray(exportable.combined_guidance),
    qa_checks: stringArray(exportable.qa_checks).concat(stringArray(safeConstraints.verify)).filter(uniqueFilter),
    do_not_clone: stringArray(exportable.do_not_clone).concat(stringArray(safeConstraints.do_not_clone)).filter(uniqueFilter)
  };
}

function swatch(name: string, value: string): string {
  return `<div class="swatch"><span class="chip" style="background: ${escapeAttribute(value)}"></span><span><strong>${escapeHtml(name)}</strong> ${escapeHtml(value)}</span></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function uniqueFilter(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
