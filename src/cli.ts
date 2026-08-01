import { Command } from "commander";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { importBriefWeaverRun } from "./brief-weaver.js";
import { formatCommand, sendPidgeHandoff } from "./pidge.js";
import { buildPaletteRun, cssVarsForPalette, normalizeHueFamily, normalizeRelationship, parseHexToOklch } from "./color.js";
import { colorNameCount, searchColorNames } from "./color-names.js";
import { exportAEyesIntakeVariants, exportAEyesTokens, exportAgentBriefs, exportCssVars } from "./exports.js";
import { readJson, readText, writeJson, writeText } from "./io.js";
import { inspectRun } from "./manifest.js";
import { writePreview } from "./preview.js";
import { pullAssets } from "./pull.js";
import { readInput } from "./read-mode.js";
import { formatRiffFlags, runReriff, runRiff, type RiffRun } from "./riff.js";
import { scrubDesignMarkdown, scrubSourceText } from "./scrub.js";
import { writeStudioPreview } from "./studio-preview.js";
import { buildTechnologyContext, readWhifflerScan, runWhiffler, type TechnologyContext } from "./technology.js";
import { exportDesignMd } from "./designmd.js";
import { classifyDesignArchetype, designArchetypeVariantGuidance } from "./design-system-taxonomy.js";
import { buildDesignScoreReport } from "./design-score.js";
import { analyzePaletteFromSource } from "./palette-analysis.js";

const program = new Command();

program
  .name("rizzfizz")
  .description("CLI-first design intelligence utility for scrubbed website-builder briefs and OKLCH palettes.")
  .version("0.2.0");

program.command("scrub-md")
  .description("Scrub a Design Markdown file and emit source-safe design DNA, palette variants, and builder briefs.")
  .requiredOption("--input <path>", "Design Markdown input path")
  .requiredOption("--out <dir>", "Output run directory")
  .option("--variants <n>", "Variant count", parsePositiveInt, 4)
  .option("--relationship <name>", "Palette relationship preset")
  .option("--hue <family>", "Hue family such as blue, green, amber, coral, violet")
  .option("--tech-scan <path>", "Existing Whiffler --json output to preserve and summarize")
  .option("--tech-url <url>", "Run Waffle Whiffler against this URL and include technology context")
  .option("--whiffler <path>", "Whiffler CLI JS path (or set RIFF_WHIF_BIN)")
  .option("--aggressive-tech-scan", "Use Waffle Whiffler aggressive mode for --tech-url", false)
  .option("--skip-palette", "Scrub identity only — do not generate colour profiles / palette variants", false)
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
      aggressiveTechScan: options.aggressiveTechScan,
      noPalette: Boolean(options.skipPalette)
    });
    console.log(`Wrote RizzFizz run: ${result.outDir}`);
    if (result.paletteRun) {
      console.log(`Variants: ${result.paletteRun.variants.map((item) => item.id).join(", ")}`);
    } else {
      console.log("Mode: skip-palette (identity scrub only; no colour generation)");
    }
  });

program.command("tech-scan")
  .description("Run or summarize Waffle Whiffler technology detection for RizzFizz agent briefs.")
  .requiredOption("--out <path>", "Output technology-context JSON path")
  .option("--url <url>", "URL to scan with Waffle Whiffler")
  .option("--input <path>", "Existing Whiffler --json output")
  .option("--whiffler <path>", "Whiffler CLI JS path (or set RIFF_WHIF_BIN)")
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

program.command("read")
  .description("Read-only: summarise colours / run artifacts without generating new palettes.")
  .requiredOption("--input <path>", "Run directory, palette-run JSON, riff-run JSON, CSS, HTML, or text")
  .option("--json", "Emit machine-readable JSON", false)
  .action(async (options) => {
    const result = await readInput(options.input);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${result.summary}\n`);
    if (result.colors.length > 0) {
      process.stdout.write("Colours:\n");
      for (const c of result.colors.slice(0, 40)) {
        process.stdout.write(`  ${c.hex}${c.name ? `  ${c.name}` : ""}${c.role ? `  (${c.role})` : ""}\n`);
      }
      if (result.colors.length > 40) process.stdout.write(`  … +${result.colors.length - 40} more\n`);
    }
  });

program.command("colors")
  .description("Search the open colour-name dictionary (CSS + XKCD + meodai; not Pantone).")
  .option("--search <query>", "Substring search")
  .option("--limit <n>", "Max results", parsePositiveInt, 25)
  .action(async (options) => {
    if (!options.search) {
      console.log(`Colour dictionary: ${colorNameCount()} names`);
      console.log("Sources: W3C CSS named colours, XKCD Color Survey, meodai/color-names (MIT).");
      console.log("Example: rizzfizz colors --search \"ocean blue\"");
      return;
    }
    const hits = searchColorNames(options.search, options.limit);
    for (const hit of hits) {
      console.log(`${hit.hex}  ${hit.name}  [${hit.source}]`);
    }
    if (hits.length === 0) console.log("No matches.");
  });

program.command("riff")
  .description("Riff new palette versions from locked colour names / variance DSL.")
  .argument("[spec...]", "Riff DSL, e.g. 'orange, dark blue grey, 3, +3' or '~blue(+10), 3, +3'")
  .option("--out <path>", "Write rizzfizz.riff-run.v1 JSON")
  .option("--seed <seed>", "Deterministic RNG seed (printed in FLAG lines)")
  .option("--json", "Print full JSON to stdout", false)
  .addHelpText("after", `
Examples:
  rizzfizz riff blue
  rizzfizz riff "blue green, 3, +5"
  rizzfizz riff "orange, dark blue grey, 3, +3"
  rizzfizz riff "~blue(+10), 3, +3"
  rizzfizz riff "~yellow sun(20), orange"
  rizzfizz riff "~grey green(-23, +10), 2, +2"
  rizzfizz riff "~ALL(10), blue, 2, +3"
  rizzfizz riff "~ALL(-35,-20,-10), orange, 2, +3"
  rizzfizz --riff "blue, 3, +5"

Variance percents move toward neighbouring named colours on the hue spectrum.
WARN lines fire when a requested range passes the midpoint or overshoots a neighbour.
FLAG lines always include seed + rolls for reriff.`)
  .action(async (specParts: string[], options) => {
    const spec = specParts.join(" ").trim();
    if (!spec) throw new Error("riff requires a DSL spec (see --help)");
    await executeRiff(spec, options);
  });

program.command("reriff")
  .description("Re-roll a previous riff run with locked colours (from FLAG hex/oklch/name).")
  .requiredOption("--input <path>", "Previous riff-run JSON")
  .requiredOption("--lock <color>", "Locked colour (hex, oklch(...), or name). Repeatable.", collect, [])
  .option("--spec <dsl>", "Optional trailing DSL for remaining gen count / variance (first-wins vs --lock)")
  .option("--out <path>", "Write new riff-run JSON")
  .option("--seed <seed>", "Override seed")
  .option("--json", "Print full JSON to stdout", false)
  .action(async (options) => {
    if (!options.lock || options.lock.length === 0) {
      throw new Error("reriff requires at least one --lock");
    }
    const previous = await readJson<RiffRun>(resolve(options.input));
    const run = runReriff({
      previous,
      lock: options.lock,
      spec: options.spec,
      seed: options.seed
    });
    await emitRiffRun(run, options);
  });

program.command("preview")
  .description("Generate a static source-safe HTML preview page for variant selection.")
  .requiredOption("--input <path>", "scrub-md run directory, palette-run.json, or riff-run.json")
  .requiredOption("--out <path>", "Output HTML path")
  .option("--studio", "Interactive studio preview (menubar, palettes, editable copy)", false)
  .option("--site-name <name>", "Site name in menubar / hero (default INSP-VALUE when unknown)")
  .option("--page-name <name>", "Page name metadata")
  .option("--insp <label>", "Inspired-by label or URL shown in footer / menubar context")
  .option("--bar <pos>", "Menubar position: top | bottom | both", "both")
  .action(async (options) => {
    if (options.studio) {
      const bar = normalizeBar(options.bar);
      const outPath = await writeStudioPreview({
        input: options.input,
        out: options.out,
        siteName: options.siteName,
        pageName: options.pageName,
        insp: options.insp,
        bar
      });
      console.log(`Wrote studio preview: ${outPath}`);
      return;
    }
    const outPath = await writePreview({ input: options.input, out: options.out });
    console.log(`Wrote preview: ${outPath}`);
  });

program.command("studio")
  .description("Interactive studio HTML preview (alias for preview --studio).")
  .requiredOption("--input <path>", "scrub-md run directory, palette-run.json, or riff-run.json")
  .requiredOption("--out <path>", "Output HTML path")
  .option("--site-name <name>", "Site name in menubar / hero")
  .option("--page-name <name>", "Page name metadata")
  .option("--insp <label>", "Inspired-by label or URL")
  .option("--bar <pos>", "Menubar position: top | bottom | both", "both")
  .action(async (options) => {
    const outPath = await writeStudioPreview({
      input: options.input,
      out: options.out,
      siteName: options.siteName,
      pageName: options.pageName,
      insp: options.insp,
      bar: normalizeBar(options.bar)
    });
    console.log(`Wrote studio preview: ${outPath}`);
  });

program.command("pull")
  .description("Pull inspire metadata, copy, and/or images from a site (polite fetch; escalate only when needed).")
  .requiredOption("--out <dir>", "Output directory for pull-manifest.json and assets")
  .option("--insp <url>", "Inspired-by URL (title + status probe)")
  .option("--copy <url>", "Pull page copy to pulled-copy.txt")
  .option("--img <url>", "Pull first N images from page")
  .option("--count <n>", "Image count for --img", parsePositiveInt, 3)
  .option("--fastcopy", "Copy: fetch only (no escalation plan)", false)
  .option("--fastimg", "Images: fetch only", false)
  .option("--allcopy", "Estimate duration and mark async queue for deep copy crawl", false)
  .option("--allimg", "Estimate duration and mark async queue for image crawl", false)
  .action(async (options) => {
    const result = await pullAssets({
      out: options.out,
      insp: options.insp,
      copy: options.copy,
      img: options.img,
      imgCount: options.count,
      fastCopy: options.fastcopy,
      fastImg: options.fastimg,
      allCopy: options.allcopy,
      allImg: options.allimg
    });
    console.log(`Wrote pull manifest: ${resolve(options.out, "pull-manifest.json")}`);
    if (result.insp) console.log(`insp: ${result.insp.status} ${result.insp.title || ""}`.trim());
    if (result.copy) console.log(`copy: ${result.copy.chars} chars → ${result.copy.text_path}`);
    if (result.images) console.log(`images: ${result.images.count} → ${result.images.paths.join(", ") || "(none)"}`);
    for (const note of result.notes) console.log(`note: ${note}`);
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
    const techContext = options.techContext
      ? formatTechnologyContextMarkdown(await loadTechnologyContext(resolve(options.techContext)))
      : undefined;
    const paths = await exportDesignMd({
      input: resolve(options.input),
      out: resolve(options.out),
      name: options.name,
      description: options.description,
      techContext,
    });
    console.log(`Wrote ${paths.length} DESIGN.md files to ${resolve(options.out)}`);
    for (const p of paths) console.log(`  ${p}`);
  });

async function executeRiff(spec: string, options: { out?: string; seed?: string; json?: boolean }): Promise<void> {
  const run = runRiff({ spec, seed: options.seed });
  await emitRiffRun(run, options);
}

async function emitRiffRun(run: RiffRun, options: { out?: string; json?: boolean }): Promise<void> {
  // Always emit FLAG/WARN lines before JSON/body so agents can parse locks for --reriff.
  console.error(formatRiffFlags(run));
  if (options.out) {
    await writeJson(resolve(options.out), run);
    console.log(`Wrote riff run: ${resolve(options.out)}`);
  }
  if (options.json || !options.out) {
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
  }
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}

function normalizeBar(value: string): "top" | "bottom" | "both" {
  if (value === "top" || value === "bottom" || value === "both") return value;
  throw new Error(`--bar must be top|bottom|both, got ${value}`);
}

async function main(): Promise<void> {
  // Top-level shortcut: rizzfizz --riff "…"
  const argv = process.argv.slice(2);
  const riffFlag = argv.indexOf("--riff");
  if (riffFlag >= 0) {
    const known = new Set([
      "scrub-md", "tech-scan", "handoff", "inspect", "read", "colors", "riff", "reriff",
      "preview", "studio", "pull", "import-brief-weaver", "palette", "design-archetype", "palette-analyze",
      "design-score", "export", "css-vars", "design-md", "help"
    ]);
    const hasSub = argv.some((a) => known.has(a));
    if (!hasSub) {
      const spec = argv[riffFlag + 1];
      if (!spec) throw new Error("--riff requires a DSL string");
      const rest = argv.filter((_, i) => i !== riffFlag && i !== riffFlag + 1);
      let out: string | undefined;
      let seed: string | undefined;
      let json = false;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--out") out = rest[++i];
        else if (rest[i] === "--seed") seed = rest[++i];
        else if (rest[i] === "--json") json = true;
      }
      await executeRiff(spec, { out, seed, json });
      return;
    }
  }
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`rizzfizz: ${message}`);
  process.exitCode = 1;
});

async function loadTechnologyContext(path: string): Promise<TechnologyContext> {
  const value = await readJson<Record<string, unknown>>(path);
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid technology context at ${path}: expected a JSON object`);
  }
  if (value.schema !== "rizzfizz.technology-context.v2") {
    throw new Error(
      `Invalid technology context at ${path}: expected schema "rizzfizz.technology-context.v2"`
    );
  }
  return value as TechnologyContext;
}

function sanitizeTechContextText(value: string): string {
  return scrubSourceText(value, []);
}

function formatTechnologyContextMarkdown(context: TechnologyContext): string {
  const recommendations = context.recommendations || {
    detected_stack_summary: "",
    builder_use: [],
    cautions: [],
    stack_fit: "",
    do_not_clone: []
  };
  const detected = (context.detected || [])
    .slice(0, 8)
    .map((tech) => sanitizeTechContextText(tech.name || ""))
    .filter(Boolean);
  const stackFit = sanitizeTechContextText(recommendations.stack_fit || "unspecified");
  const summary = sanitizeTechContextText(recommendations.detected_stack_summary || "");
  const doNotClone = (recommendations.do_not_clone || [])
    .slice(0, 6)
    .map((item) => sanitizeTechContextText(item))
    .filter(Boolean);
  const lines = [
    `**Stack fit:** ${stackFit}`,
    ""
  ];
  if (summary) {
    lines.push(summary, "");
  }
  if (detected.length > 0) {
    lines.push("**Detected (top):**", ...detected.map((name) => `- ${name}`), "");
  }
  if (doNotClone.length > 0) {
    lines.push("**Do not clone:**", ...doNotClone.map((item) => `- ${item}`));
  }
  return lines.join("\n").trim();
}
