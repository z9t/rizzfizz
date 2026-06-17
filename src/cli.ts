import { Command } from "commander";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { importBriefWeaverRun } from "./brief-weaver.js";
import { formatCommand, sendPidgeHandoff } from "./pidge.js";
import { buildPaletteRun, cssVarsForPalette, normalizeHueFamily, normalizeRelationship, parseHexToOklch } from "./color.js";
import { exportAEyesIntakeVariants, exportAEyesTokens, exportAgentBriefs, exportCssVars } from "./exports.js";
import { readText, writeJson, writeText } from "./io.js";
import { inspectRun } from "./manifest.js";
import { writePreview } from "./preview.js";
import { scrubDesignMarkdown } from "./scrub.js";
import { buildTechnologyContext, readWhifflerScan, runWhiffler } from "./technology.js";
import { exportDesignMd } from "./designmd.js";
import { classifyDesignArchetype, designArchetypeVariantGuidance } from "./design-system-taxonomy.js";
import { buildDesignScoreReport } from "./design-score.js";
import { analyzePaletteFromSource } from "./palette-analysis.js";

const program = new Command();

program
  .name("rizzfizz")
  .description("CLI-first design intelligence utility for scrubbed website-builder briefs and OKLCH palettes.")
  .version("0.1.0");

program.command("scrub-md")
  .description("Scrub a Design Markdown file and emit source-safe design DNA, palette variants, and builder briefs.")
  .requiredOption("--input <path>", "Design Markdown input path")
  .requiredOption("--out <dir>", "Output run directory")
  .option("--variants <n>", "Variant count", parsePositiveInt, 4)
  .option("--relationship <name>", "Palette relationship preset")
  .option("--hue <family>", "Hue family such as blue, green, amber, coral, violet")
  .option("--tech-scan <path>", "Existing Whiffler --json output to preserve and summarize")
  .option("--tech-url <url>", "Run Waffle Whiffler against this URL and include technology context")
  .option("--whiffler <path>", "Whiffler CLI path", "/Users/max/Documents/Code/whiffler/src/cli/whiffler.js")
  .option("--aggressive-tech-scan", "Use Waffle Whiffler aggressive mode for --tech-url", false)
  .action(async (options) => {
    const result = await scrubDesignMarkdown({
      input: options.input,
      out: options.out,
      variants: options.variants,
      relationship: options.relationship,
      hue: options.hue,
      techScan: options.techScan,
      techUrl: options.techUrl,
      whiffler: options.whiffler,
      aggressiveTechScan: options.aggressiveTechScan
    });
    console.log(`Wrote RizzFizz run: ${result.outDir}`);
    console.log(`Variants: ${result.paletteRun.variants.map((item) => item.id).join(", ")}`);
  });

program.command("tech-scan")
  .description("Run or summarize Waffle Whiffler technology detection for RizzFizz agent briefs.")
  .requiredOption("--out <path>", "Output technology-context JSON path")
  .option("--url <url>", "URL to scan with Waffle Whiffler")
  .option("--input <path>", "Existing Whiffler --json output")
  .option("--whiffler <path>", "Whiffler CLI path", "/Users/max/Documents/Code/whiffler/src/cli/whiffler.js")
  .option("--aggressive", "Use Waffle Whiffler aggressive mode with --url", false)
  .option("--timeout <ms>", "Waffle Whiffler timeout", parsePositiveInt)
  .action(async (options) => {
    if (!options.url && !options.input) {
      throw new Error("tech-scan requires --url or --input");
    }
    const scan = options.input
      ? await readWhifflerScan(resolve(options.input))
      : await runWhiffler({
        url: options.url,
        executable: options.whiffler,
        aggressive: options.aggressive,
        timeout: options.timeout
      });
    await writeJson(resolve(options.out), buildTechnologyContext(scan));
    console.log(`Wrote technology context: ${resolve(options.out)}`);
  });

program.command("handoff")
  .description("Package a RizzFizz run and send it through Pidge for another local agent.")
  .requiredOption("--input <dir>", "scrub-md run directory")
  .requiredOption("--to <agent>", "recipient agent name, e.g. hermes, gemma, claude, codex, opencode, human")
  .option("--from <agent>", "sender agent name", "codex")
  .option("--kind <kind>", "pidge message kind", "rizzfizz-handoff")
  .option("--summary <text>", "pidge summary")
  .option("--context-hint <text>", "pidge context hint")
  .option("--variant <id>", "variant id to hand off, or all", "all")
  .option("--pidge <path>", "pidge executable path", "pidge")
  .option("--expects-response", "mark handoff as expecting a response", false)
  .option("--dry-run", "write payload and print the pidge command without sending", false)
  .option("--include-raw", "attach raw-reference.json; off by default to preserve source-safe handoffs", false)
  .option("--risk <label>", "pidge risk label", "low")
  .action(async (options) => {
    const result = await sendPidgeHandoff({
      input: options.input,
      from: options.from,
      to: options.to,
      kind: options.kind,
      summary: options.summary,
      contextHint: options.contextHint,
      variant: options.variant,
      pidge: options.pidge,
      expectsResponse: options.expectsResponse,
      dryRun: options.dryRun,
      includeRaw: options.includeRaw,
      risk: options.risk
    });
    console.log(`Wrote pidge payload: ${result.payloadPath}`);
    console.log(`Attachments: ${result.attachments.length}`);
    if (result.dryRun) {
      console.log(formatCommand(result.command));
    } else {
      console.log(result.stdout);
    }
  });

program.command("inspect")
  .description("Print a compact source-safe summary of a RizzFizz run.")
  .requiredOption("--input <dir>", "scrub-md run directory")
  .action(async (options) => {
    process.stdout.write(`${await inspectRun(resolve(options.input))}\n`);
  });

program.command("preview")
  .description("Generate a static source-safe HTML preview page for variant selection.")
  .requiredOption("--input <dir>", "scrub-md run directory")
  .requiredOption("--out <path>", "Output HTML path")
  .action(async (options) => {
    const outPath = await writePreview({ input: options.input, out: options.out });
    console.log(`Wrote preview: ${outPath}`);
  });

program.command("import-brief-weaver")
  .description("Import an existing brief-weaver-runs/<run_id> folder into a normal source-safe RizzFizz run surface.")
  .requiredOption("--input <dir>", "Existing Brief Weaver run directory, e.g. brief-weaver-runs/<run_id>")
  .requiredOption("--out <dir>", "Output RizzFizz run directory")
  .option("--no-preview", "Skip preview.html generation")
  .action(async (options) => {
    const result = await importBriefWeaverRun({
      input: options.input,
      out: options.out,
      preview: options.preview
    });
    console.log(`Imported Brief Weaver run: ${result.inputDir}`);
    console.log(`Wrote RizzFizz run: ${result.outDir}`);
    console.log(`Variants: ${result.variantIds.join(", ")}`);
    if (result.previewPath) console.log(`Preview: ${result.previewPath}`);
  });

program.command("palette")
  .description("Generate OKLCH palette variants from a relationship preset and hue family.")
  .requiredOption("--out <path>", "Output palette-run JSON path")
  .option("--relationship <name>", "Palette relationship preset", "dark-sparse-accent")
  .option("--hue <family>", "Hue family such as blue, green, amber, coral, violet", "blue")
  .option("--variants <n>", "Variant count", parsePositiveInt, 4)
  .option("--seed <hex>", "Optional seed hex. V1 validates/parses it but still uses the requested or inferred hue family.")
  .action(async (options) => {
    if (options.seed) parseHexToOklch(options.seed);
    const run = buildPaletteRun({
      relationship: normalizeRelationship(options.relationship),
      hue: normalizeHueFamily(options.hue),
      variants: options.variants,
      source: options.seed ? `seed:${options.seed}` : "cli"
    });
    await writeJson(resolve(options.out), run);
    console.log(`Wrote palette run: ${resolve(options.out)}`);
  });

program.command("design-archetype")
  .description("Classify HTML/CSS implementation archetype and emit safe variant constraints.")
  .requiredOption("--html <path>", "HTML/markup input path")
  .requiredOption("--css <path>", "CSS input path")
  .requiredOption("--out <path>", "Output design archetype report JSON path")
  .action(async (options) => {
    const htmlPath = resolve(options.html);
    const cssPath = resolve(options.css);
    const classification = classifyDesignArchetype({
      html: await readText(htmlPath),
      css: await readText(cssPath)
    });
    const guidance = designArchetypeVariantGuidance(classification);
    const report = {
      schema: "rizzfizz.design-archetype-report.v1",
      source_safe: true,
      inputs: {
        html: "redacted-local-path",
        css: "redacted-local-path"
      },
      feature_vector: classification.feature_vector,
      softmax_distribution: classification.probabilities,
      primary_archetype: classification.primary,
      secondary_archetype: classification.secondary,
      confidence: classification.primary.probability,
      classification,
      safe_variation_rules: guidance.safe_variation_rules,
      variant_constraints: guidance.variant_constraints,
      do_not_clone: guidance.do_not_clone,
      guidance
    };
    await writeJson(resolve(options.out), report);
    console.log(`Wrote design archetype: ${resolve(options.out)}`);
  });

program.command("palette-analyze")
  .description("Extract a live-ish palette from CSS/HTML text and score OKLCH design quality signals.")
  .option("--html <path>", "HTML/markup input path")
  .option("--css <path>", "CSS input path")
  .requiredOption("--out <path>", "Output palette analysis report JSON path")
  .action(async (options) => {
    if (!options.html && !options.css) {
      throw new Error("palette-analyze requires --html or --css");
    }
    const report = analyzePaletteFromSource({
      html: options.html ? await readText(resolve(options.html)) : undefined,
      css: options.css ? await readText(resolve(options.css)) : undefined
    });
    await writeJson(resolve(options.out), report);
    console.log(`Wrote palette analysis: ${resolve(options.out)}`);
  });

program.command("design-score")
  .description("Emit a report-card design score with a-eyes palette intake and exportable palette/archetype guidance.")
  .option("--html <path>", "HTML/markup input path")
  .option("--css <path>", "CSS input path")
  .option("--a-eyes-json <path>", "a-eyes JSON palette/pixel-diff artifact")
  .option("--a-eyes-png <path>", "a-eyes PNG capture artifact for simple dominant-color extraction")
  .option("--style-text <text>", "Optional source-safe style/archetype notes")
  .requiredOption("--out <path>", "Output design score report JSON path")
  .action(async (options) => {
    if (!options.html && !options.css && !options.aEyesJson && !options.aEyesPng) {
      throw new Error("design-score requires --html, --css, --a-eyes-json, or --a-eyes-png");
    }
    const report = buildDesignScoreReport({
      html: options.html ? await readText(resolve(options.html)) : undefined,
      css: options.css ? await readText(resolve(options.css)) : undefined,
      aEyesJson: options.aEyesJson ? JSON.parse(await readText(resolve(options.aEyesJson))) : undefined,
      aEyesPng: options.aEyesPng ? readFileSync(resolve(options.aEyesPng)) : undefined,
      styleText: options.styleText
    });
    await writeJson(resolve(options.out), report);
    console.log(`Wrote design score: ${resolve(options.out)}`);
    console.log(`Grade: ${report.report_card.grade} (${report.report_card.score}/100)`);
  });

program.command("export")
  .description("Export palette or run artifacts into builder-consumable formats.")
  .requiredOption("--format <format>", "a-eyes-variant-tokens, a-eyes-intake-variants, agent-brief, or css-vars")
  .requiredOption("--input <path>", "Input palette-run JSON or scrub-md run directory")
  .requiredOption("--out <path>", "Output path")
  .action(async (options) => {
    const format = String(options.format);
    if (format === "a-eyes-variant-tokens") {
      await exportAEyesTokens(resolve(options.input), resolve(options.out));
    } else if (format === "a-eyes-intake-variants") {
      await exportAEyesIntakeVariants(resolve(options.input), resolve(options.out));
    } else if (format === "agent-brief") {
      await exportAgentBriefs(resolve(options.input), resolve(options.out));
    } else if (format === "css-vars") {
      await exportCssVars(resolve(options.input), resolve(options.out));
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
    console.log(`Wrote ${format}: ${resolve(options.out)}`);
  });

program.command("css-vars")
  .description("Convenience command: generate CSS vars from a relationship/hue without writing a palette run first.")
  .option("--relationship <name>", "Palette relationship preset", "dark-sparse-accent")
  .option("--hue <family>", "Hue family", "blue")
  .option("--out <path>", "Output CSS path")
  .action(async (options) => {
    const run = buildPaletteRun({
      relationship: options.relationship,
      hue: options.hue,
      variants: 1,
      source: "cli"
    });
    const css = cssVarsForPalette(run);
    if (options.out) {
      await writeText(resolve(options.out), css);
      console.log(`Wrote CSS vars: ${resolve(options.out)}`);
    } else {
      process.stdout.write(css);
    }
  });

program.command("design-md")
  .description("Emit Google DESIGN.md spec-compliant output from a RizzFizz palette run.")
  .requiredOption("--input <dir>", "scrub-md run directory")
  .requiredOption("--out <dir>", "output directory for DESIGN.md files")
  .option("--name <name>", "design system name")
  .option("--description <text>", "design system description")
  .option("--tech-context <path>", "Whiffler technology-context.json to embed")
  .action(async (options) => {
    const paths = await exportDesignMd({
      input: resolve(options.input),
      out: resolve(options.out),
      name: options.name,
      description: options.description,
      techContext: options.techContext,
    });
    console.log(`Wrote ${paths.length} DESIGN.md files to ${resolve(options.out)}`);
    for (const p of paths) console.log(`  ${p}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`rizzfizz: ${message}`);
  process.exitCode = 1;
});

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}
