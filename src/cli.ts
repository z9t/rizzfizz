import { Command } from "commander";
import { resolve } from "node:path";
import { formatCommand, sendPidgeHandoff } from "./pidge.js";
import { buildPaletteRun, cssVarsForPalette, normalizeHueFamily, normalizeRelationship, parseHexToOklch } from "./color.js";
import { exportAEyesTokens, exportAgentBriefs, exportCssVars } from "./exports.js";
import { writeJson, writeText } from "./io.js";
import { scrubDesignMarkdown } from "./scrub.js";
import { buildTechnologyContext, readWhifflerScan, runWhiffler } from "./technology.js";

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

program.command("export")
  .description("Export palette or run artifacts into builder-consumable formats.")
  .requiredOption("--format <format>", "a-eyes-variant-tokens, agent-brief, or css-vars")
  .requiredOption("--input <path>", "Input palette-run JSON or scrub-md run directory")
  .requiredOption("--out <path>", "Output path")
  .action(async (options) => {
    const format = String(options.format);
    if (format === "a-eyes-variant-tokens") {
      await exportAEyesTokens(resolve(options.input), resolve(options.out));
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
