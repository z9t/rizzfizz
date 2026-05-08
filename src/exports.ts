import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import type { PaletteRun, PaletteVariant } from "./types.js";
import { cssVarsForPalette } from "./color.js";
import { readJson, writeJson, writeText } from "./io.js";
import { paletteRunSchema } from "./schemas.js";
import type { TechnologyContext } from "./technology.js";

export function aEyesVariantTokens(run: PaletteRun): unknown {
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
      technology_direction: technologyDirectionForVariant(variant)
    }))
  };
}

export async function exportAEyesTokens(input: string, out: string): Promise<void> {
  const run = paletteRunSchema.parse(await readJson(input)) as PaletteRun;
  await writeJson(out, aEyesVariantTokens(run));
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
  await writeAgentBriefs(outDir, run, dna, basename(inputDir), technologyContext);
}

export async function writeAgentBriefs(
  outDir: string,
  run: PaletteRun,
  dna: Record<string, unknown>,
  sourceLabel: string,
  technologyContext?: TechnologyContext
): Promise<void> {
  await Promise.all(run.variants.map((variant) => {
    const content = agentBriefMarkdown(variant, dna, sourceLabel, technologyContext);
    return writeText(join(outDir, `${variant.id}.md`), content);
  }));
}

export function agentBriefMarkdown(
  variant: PaletteVariant,
  dna: Record<string, unknown>,
  sourceLabel: string,
  technologyContext?: TechnologyContext
): string {
  const technology = technologyDirectionForVariant(variant);
  return `# ${variant.name} Builder Brief

Build the actual usable website experience described by this design direction. Do not create a generic landing page or a marketing-only wrapper around placeholder content.

## Design Direction

- source-safe run: ${sourceLabel}
- palette relationship: ${variant.palette_relationship.relationship}
- accent usage: ${variant.palette_relationship.accent_usage}
- typography: use a premium role-based type system; pair a strong heading face with a highly readable body face without copying proprietary source font identity
- layout: preserve the abstract hierarchy and density from the design DNA; avoid source-specific brand layouts or distinctive copied phrasing
- motion: use restrained motion that clarifies hierarchy; respect \`prefers-reduced-motion\`

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

## Design DNA Summary

\`\`\`json
${JSON.stringify({
  design_system: dna.design_system,
  design_style: dna.design_style,
  visual_effects: dna.visual_effects
}, null, 2)}
\`\`\`

## Quality Bar

- Semantic HTML and accessible controls.
- WCAG 2.2 AA body text contrast, visible keyboard focus, and no focus-obscuring overlays.
- Responsive desktop and mobile layouts with no clipped text or overlapping UI.
- Use icons for clear tool/button actions when appropriate.
- Verify desktop and roughly 390px mobile with Playwright screenshots before finishing.
- Record visual inspection findings before marking the build complete.
`;
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
