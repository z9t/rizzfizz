import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AEyesIntakeVariants, BuildContract, BuildContractVariant, DesignScoreVariantGuidance, PaletteRun, PaletteVariant } from "./types.js";
import { cssVarsForPalette } from "./color.js";
import { readJson, writeJson, writeText } from "./io.js";
import { paletteRunSchema } from "./schemas.js";
import type { TechnologyContext } from "./technology.js";

export function aEyesVariantTokens(
  run: PaletteRun,
  options: { technologyByVariant?: Map<string, Record<string, unknown>>; designScoreGuidance?: DesignScoreVariantGuidance } = {}
): unknown {
  return {
    schema: "rizzfizz.a-eyes-variant-tokens.v1",
    source_palette_run: run.source,
    created_at: new Date().toISOString(),
    variants: run.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      palette_direction: `${variant.palette_relationship.relationship}.`,
      palette_relationship: variant.palette_relationship,
      palette_tokens: variant.tokens,
      palette_usage: variant.palette_usage,
      technology_direction: options.technologyByVariant?.get(variant.id) || technologyDirectionForVariant(variant),
      ...(options.designScoreGuidance ? { design_score_guidance: options.designScoreGuidance } : {})
    }))
  };
}

export async function exportAEyesTokens(input: string, out: string): Promise<void> {
  const run = paletteRunSchema.parse(await readJson(input)) as PaletteRun;
  const designScoreGuidance = await maybeReadDesignScoreGuidance(join(input, ".."));
  await writeJson(out, aEyesVariantTokens(run, { designScoreGuidance }));
}

export async function exportCssVars(input: string, out: string): Promise<void> {
  const run = paletteRunSchema.parse(await readJson(input)) as PaletteRun;
  await writeText(out, cssVarsForPalette(run));
}

export async function exportAgentBriefs(inputDir: string, outDir: string): Promise<void> {
  const run = paletteRunSchema.parse(await readJson(join(inputDir, "palette-run.json"))) as PaletteRun;
  const dna = await readJson<Record<string, unknown>>(join(inputDir, "scrubbed-design-dna.json"));
  const technologyContextPath = join(inputDir, "technology-context.json");
  const technologyContext = await exists(technologyContextPath)
    ? await readJson<TechnologyContext>(technologyContextPath)
    : undefined;
  const contractPath = join(inputDir, "build-contract.json");
  const contract = await exists(contractPath)
    ? await readJson<BuildContract>(contractPath)
    : undefined;
  await writeAgentBriefs(outDir, run, dna, basename(inputDir), technologyContext, contract, await maybeReadDesignScoreGuidance(inputDir));
}

export async function exportAEyesIntakeVariants(inputDir: string, out: string): Promise<void> {
  const run = paletteRunSchema.parse(await readJson(join(inputDir, "palette-run.json"))) as PaletteRun;
  const contract = await readJson<BuildContract>(join(inputDir, "build-contract.json"));
  const technologyContextPath = join(inputDir, "technology-context.json");
  const technologyContext = await exists(technologyContextPath)
    ? await readJson<TechnologyContext>(technologyContextPath)
    : undefined;
  await writeJson(out, aEyesIntakeVariants(run, contract, technologyContext, await maybeReadDesignScoreGuidance(inputDir)));
}

export function aEyesIntakeVariants(
  run: PaletteRun,
  contract: BuildContract,
  technologyContext?: TechnologyContext,
  designScoreGuidance?: DesignScoreVariantGuidance
): AEyesIntakeVariants {
  return {
    master_brief: {
      title: titleCase(contract.intent.site_type),
      raw_idea_summary: contract.intent.content_posture,
      target_user: contract.intent.audience,
      site_goal: contract.intent.primary_job,
      must_include: [
        contract.layout.first_viewport,
        ...contract.components.required.map((component) => `${component.name}: ${component.purpose}`)
      ],
      must_avoid: contract.avoid,
      content_notes: contract.intent.secondary_jobs,
      motion_intent: motionIntent(contract),
      success_criteria: contract.visual_qa.checks
    },
    shared_constraints: {
      viewport_targets: ["desktop", "mobile"],
      accessibility_notes: [
        "Use semantic HTML and accessible controls.",
        "Keep keyboard focus visible and unobscured.",
        "Meet WCAG 2.2 AA body text contrast."
      ],
      technical_constraints: technicalConstraints(contract, technologyContext),
      a_eyes_required: true
    },
    variants: run.variants.map((variant) => {
      const contractVariant = contract.variants.find((item) => item.id === variant.id);
      return {
        id: variant.id,
        name: variant.name,
        design_direction: designDirection(contract, contractVariant),
        layout_strategy: layoutStrategy(contract),
        palette_direction: `${variant.palette_relationship.relationship}.`,
        palette_relationship: variant.palette_relationship,
        palette_tokens: contractVariant?.palette_tokens || variant.tokens,
        palette_usage: contractVariant?.palette_usage || variant.palette_usage,
        typography_direction: "Use a premium role-based type system: strong source-safe heading face, readable body face, and system monospace only for technical labels.",
        technology_direction: technologyDirection(contractVariant, variant, technologyContext),
        motion_direction: motionDirection(contract),
        hero_or_primary_view: contract.layout.first_viewport,
        sections: contract.layout.regions.map((region) => `${region.id}: ${region.purpose}`),
        specific_requirements: [
          ...contract.components.required.flatMap((component) => component.constraints),
          ...(contractVariant?.visual_rules || []),
          ...contract.visual_qa.checks,
          ...(designScoreGuidance?.combined_guidance || []),
          ...(designScoreGuidance?.palette_constraints || []),
          ...(designScoreGuidance?.archetype_constraints.locked.map((item) => `Design-score locked trait: ${item}`) || []),
          ...(designScoreGuidance?.archetype_constraints.may_vary.map((item) => `Design-score may vary safely: ${item}`) || [])
        ],
        risk_notes: [
          ...contract.visual_qa.fail_if,
          ...(designScoreGuidance?.do_not_clone.map((item) => `Design-score do not clone: ${item}`) || [])
        ],
        ...(designScoreGuidance ? { design_score_guidance: designScoreGuidance } : {})
      };
    })
  };
}

export async function writeAgentBriefs(
  outDir: string,
  run: PaletteRun,
  dna: Record<string, unknown>,
  sourceLabel: string,
  technologyContext?: TechnologyContext,
  contract?: BuildContract,
  designScoreGuidance?: DesignScoreVariantGuidance
): Promise<void> {
  await Promise.all(run.variants.map((variant) => {
    const content = agentBriefMarkdown(variant, dna, sourceLabel, technologyContext, contract, designScoreGuidance);
    return writeText(join(outDir, `${variant.id}.md`), content);
  }));
}

export function agentBriefMarkdown(
  variant: PaletteVariant,
  dna: Record<string, unknown>,
  sourceLabel: string,
  technologyContext?: TechnologyContext,
  contract?: BuildContract,
  designScoreGuidance?: DesignScoreVariantGuidance
): string {
  const technology = technologyDirectionForVariant(variant);
  const contractVariant = contract?.variants.find((item) => item.id === variant.id);
  return `# ${variant.name} Builder Brief

Build the actual usable website experience described by this design direction. Do not create a generic landing page or a marketing-only wrapper around placeholder content.

${contract ? contractMarkdown(contract, contractVariant) : fallbackDnaMarkdown(dna)}

${contract?.design_system_classification ? designSystemQualityMarkdown(contract.design_system_classification) : ""}
${designScoreGuidance ? designScoreGuidanceMarkdown(designScoreGuidance) : ""}

## Design Direction

- source-safe run: ${sourceLabel}
- palette relationship: ${variant.palette_relationship.relationship}
- accent usage: ${variant.palette_relationship.accent_usage}
- typography: use a premium role-based type system; pair a strong heading face with a highly readable body face without copying proprietary source font identity
- layout: preserve the abstract hierarchy and density from the design DNA; avoid source-specific brand layouts or distinctive copied phrasing
- motion: use restrained motion that clarifies hierarchy; respect \`prefers-reduced-motion\`
- contract: use \`build-contract.json\` as the source-safe implementation contract when present

## Palette Tokens

\`\`\`json
${JSON.stringify(variant.tokens, null, 2)}
\`\`\`

${variant.palette_usage}

## Technology Direction

\`\`\`json
${JSON.stringify(technology, null, 2)}
\`\`\`

${technologyContext ? `## Detected Source Technology Context

This context came from Waffle Whiffler. Treat it as evidence about the reference/source site, not as a requirement to clone the source stack.

\`\`\`json
${JSON.stringify({
  detected: technologyContext.detected,
  recommendations: technologyContext.recommendations
}, null, 2)}
\`\`\`
` : ""}

## Quality Bar

- Semantic HTML and accessible controls.
- WCAG 2.2 AA body text contrast, visible keyboard focus, and no focus-obscuring overlays.
- Responsive desktop and mobile layouts with no clipped text or overlapping UI.
- Use icons for clear tool/button actions when appropriate.
- Verify desktop and roughly 390px mobile with Playwright screenshots before finishing.
- Record visual inspection findings before marking the build complete.
`;
}

function contractMarkdown(contract: BuildContract, variant?: BuildContractVariant): string {
  return `## Implementation Contract

- site type: ${contract.intent.site_type}
- primary job: ${contract.intent.primary_job}
- audience: ${contract.intent.audience}
- content posture: ${contract.intent.content_posture}

## Layout Contract

- first viewport: ${contract.layout.first_viewport}
- navigation: ${contract.layout.navigation}

${contract.layout.regions.map((region) => `### ${region.id}

- purpose: ${region.purpose}
- density: ${region.density}
- notes: ${region.notes.join(" ")}
`).join("\n")}
## Component Contract

${contract.components.required.map((component) => `- ${component.name}: ${component.purpose} States: ${component.states.join(", ")}. Constraints: ${component.constraints.join(" ")}`).join("\n")}

Optional: ${contract.components.optional.join("; ")}

## Motion Contract

- level: ${contract.motion.level}
- allowed techniques: ${contract.motion.allowed_techniques.join(", ")}
- reduced motion: ${contract.motion.reduced_motion}

${contract.motion.patterns.map((pattern) => `- ${pattern.name}: ${pattern.trigger}; ${pattern.duration_ms[0]}-${pattern.duration_ms[1]}ms; ${pattern.easing}; ${pattern.constraints.join(" ")}`).join("\n")}

## Visual Rules

${(variant?.visual_rules || []).map((rule) => `- ${rule}`).join("\n")}

## Visual QA

Screenshots: ${contract.visual_qa.screenshots.join("; ")}

${contract.visual_qa.checks.map((check) => `- ${check}`).join("\n")}

Fail if:
${contract.visual_qa.fail_if.map((failure) => `- ${failure}`).join("\n")}
`;
}

function designSystemQualityMarkdown(classification: BuildContract["design_system_classification"]): string {
  const secondary = classification.secondary
    ? ` Secondary signal: ${classification.secondary.name} (${classification.secondary.confidence_label}).`
    : "";
  return `## Design System Quality Direction

- primary style: ${classification.primary.name} (${classification.primary.confidence_label}, ${classification.primary.confidence})
- logical unit: ${classification.primary.qualities.logical_unit}
- grid behavior: ${classification.primary.qualities.grid_behavior}
- density: ${classification.primary.qualities.density}
- hierarchy: ${classification.primary.qualities.hierarchy}
- typography: ${classification.primary.qualities.typography}
- ornamentation: ${classification.primary.qualities.ornamentation}
- visual entropy: ${classification.primary.qualities.entropy}
- interaction feel: ${classification.primary.qualities.interaction_feel}
- token usage: ${classification.primary.qualities.token_usage}
- matched qualities: ${classification.matched_qualities.join(", ")}.${secondary}

Guidance:
${classification.primary.builder_guidance.map((item) => `- ${item}`).join("\n")}
`;
}

function designScoreGuidanceMarkdown(guidance: DesignScoreVariantGuidance): string {
  return `## Design Score Guidance

- report card: ${guidance.report_card.grade} (${guidance.report_card.score}/100)
- summary: ${guidance.report_card.summary}

Palette constraints:
${guidance.palette_constraints.map((item) => `- ${item}`).join("\n")}

Archetype locked traits:
${guidance.archetype_constraints.locked.map((item) => `- ${item}`).join("\n")}

Archetype may vary safely:
${guidance.archetype_constraints.may_vary.map((item) => `- ${item}`).join("\n")}

Verify:
${guidance.qa_checks.map((item) => `- ${item}`).join("\n")}

Do not clone:
${guidance.do_not_clone.map((item) => `- ${item}`).join("\n")}
`;
}

function fallbackDnaMarkdown(dna: Record<string, unknown>): string {
  return `## Design DNA Summary

\`\`\`json
${JSON.stringify({
  design_system: dna.design_system,
  design_style: dna.design_style,
  visual_effects: dna.visual_effects
}, null, 2)}
\`\`\`
`;
}

async function maybeReadDesignScoreGuidance(inputDir: string): Promise<DesignScoreVariantGuidance | undefined> {
  const path = join(inputDir, "design-score.json");
  if (!await exists(path)) return undefined;
  const report = await readJson<Record<string, unknown>>(path);
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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function technologyDirectionForVariant(variant: PaletteVariant): Record<string, unknown> {
  const relationship = variant.strategy;
  if (relationship === "gallery-neutral") {
    return {
      site_type: "portfolio or gallery site",
      stack: "static-html-css-js",
      libraries: ["gsap"],
      use_for: ["image transitions", "subtle reveal sequencing"],
      constraints: ["single static site folder", "must include index.html", "respect prefers-reduced-motion", "verify desktop and mobile screenshots"]
    };
  }
  if (relationship === "product-clear") {
    return {
      site_type: "product or SaaS experience",
      stack: "next-react-typescript-tailwind",
      libraries: ["shadcn/ui", "radix", "lucide-react", "motion", "zod"],
      use_for: ["accessible components", "forms", "stateful UI", "restrained interface motion"],
      constraints: ["semantic app structure", "WCAG 2.2 AA", "Core Web Vitals in scope", "Playwright responsive checks"]
    };
  }
  if (relationship === "immersive-chroma") {
    return {
      site_type: "immersive visual website",
      stack: "static-html-css-js or vite-react-typescript",
      libraries: ["gsap", "three.js when real 3D is required"],
      use_for: ["timeline animation", "canvas or WebGL effects only when brief-justified"],
      constraints: ["provide reduced-motion fallback", "avoid hiding core content behind motion", "verify visual effects render at desktop and mobile"]
    };
  }
  if (relationship === "light-editorial-accent") {
    return {
      site_type: "content, editorial, marketing, or documentation site",
      stack: "astro-typescript-tailwind",
      libraries: ["react islands only for real interactivity"],
      use_for: ["fast static HTML", "reading layout", "selective hydration"],
      constraints: ["strong typography", "low JavaScript by default", "Playwright responsive checks"]
    };
  }
  return {
    site_type: "premium static website variant",
    stack: "static-html-css-js",
    libraries: ["gsap only when sequencing materially improves the result"],
    use_for: ["subtle reveals", "focus states", "small interaction polish"],
    constraints: ["single static site folder", "must include index.html", "respect prefers-reduced-motion", "verify desktop and mobile screenshots"]
  };
}

function designDirection(contract: BuildContract, variant?: BuildContractVariant): string {
  const rules = variant?.visual_rules?.length ? ` ${variant.visual_rules.join(" ")}` : "";
  const classification = contract.design_system_classification;
  const style = classification ? ` Design system quality: ${classification.primary.name}.` : "";
  return `${contract.intent.site_type}: ${contract.intent.primary_job}${style}${rules}`.trim();
}

function layoutStrategy(contract: BuildContract): string {
  const regions = contract.layout.regions.map((region) => `${region.id} ${region.density}`).join("; ");
  return `${contract.layout.navigation} Regions: ${regions}.`;
}

function motionIntent(contract: BuildContract): string {
  return `${contract.motion.level} motion; ${contract.motion.reduced_motion}`;
}

function motionDirection(contract: BuildContract): string {
  const patterns = contract.motion.patterns
    .map((pattern) => `${pattern.name} on ${pattern.trigger} (${pattern.duration_ms[0]}-${pattern.duration_ms[1]}ms)`)
    .join("; ");
  return `${contract.motion.level} motion using ${contract.motion.allowed_techniques.join(", ")}. ${patterns}. Respect reduced motion: ${contract.motion.reduced_motion}`;
}

function technicalConstraints(contract: BuildContract, technologyContext?: TechnologyContext): string[] {
  const variantStacks = unique(contract.variants.map((variant) => {
    const stack = variant.technology_direction.stack;
    return typeof stack === "string" ? `Recommended stack option: ${stack}.` : "";
  }).filter(Boolean));
  const doNotClone = technologyContext?.recommendations.do_not_clone || [];
  return [
    ...variantStacks,
    ...contract.motion.performance_budget,
    "Builder output must be inspectable by a-eyes.",
    ...(technologyContext ? [
      `Detected source technology context: ${technologyContext.recommendations.detected_stack_summary}`,
      technologyContext.recommendations.stack_fit,
      ...technologyContext.recommendations.builder_use,
      ...technologyContext.recommendations.cautions,
      ...doNotClone.map((item) => `Do not clone from source scan: ${item}`)
    ] : [])
  ];
}

function technologyDirection(
  contractVariant: BuildContractVariant | undefined,
  variant: PaletteVariant,
  technologyContext?: TechnologyContext
): Record<string, unknown> {
  const direction = contractVariant?.technology_direction || technologyDirectionForVariant(variant);
  return {
    ...direction,
    animation: animationDirection(direction),
    ...(technologyContext ? {
      source_technology_context: sourceTechnologyContextForBuilder(technologyContext)
    } : {})
  };
}

function sourceTechnologyContextForBuilder(technologyContext: TechnologyContext): Record<string, unknown> {
  return {
    detected_stack_summary: technologyContext.recommendations.detected_stack_summary,
    stack_fit: technologyContext.recommendations.stack_fit,
    top_technologies: technologyContext.detected.slice(0, 6).map((item) => ({
      name: item.name,
      confidence: item.confidence,
      confidence_label: item.confidence_label,
      evidence_channels: item.evidence_channels,
      strongest_evidence: item.strongest_evidence || []
    })),
    weak_signals: (technologyContext.weak_signals || []).slice(0, 4).map((item) => ({
      name: item.name,
      confidence: item.confidence,
      strongest_evidence: item.strongest_evidence || []
    })),
    cautions: technologyContext.recommendations.cautions,
    do_not_clone: technologyContext.recommendations.do_not_clone || []
  };
}

function animationDirection(direction: Record<string, unknown>): Record<string, unknown> {
  const libraries = Array.isArray(direction.libraries) ? direction.libraries.map(String) : [];
  const useFor = Array.isArray(direction.use_for) ? direction.use_for.map(String) : [];
  const library = libraries.find((item) => /gsap|motion|three/i.test(item)) || "CSS transitions";
  return {
    library,
    use_for: useFor.length ? useFor : ["state feedback", "subtle reveals"],
    avoid: ["layout-shifting animation", "motion that hides content", "effects without reduced-motion fallback"]
  };
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
