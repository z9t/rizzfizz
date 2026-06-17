import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { readJson, writeJson } from "./io.js";
import { paletteRunSchema } from "./schemas.js";
import type { PaletteRun } from "./types.js";

const execFileAsync = promisify(execFile);
const DEFAULT_PIDGE = "pidge";
const AGENT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export type PidgeHandoffOptions = {
  input: string;
  from: string;
  to: string;
  kind: string;
  summary?: string;
  contextHint?: string;
  variant?: string;
  pidge?: string;
  expectsResponse?: boolean;
  dryRun?: boolean;
  includeRaw?: boolean;
  risk?: string;
};

export type PidgeHandoffResult = {
  payloadPath: string;
  attachments: string[];
  command: string[];
  stdout: string;
  dryRun: boolean;
};

export async function sendPidgeHandoff(options: PidgeHandoffOptions): Promise<PidgeHandoffResult> {
  const inputDir = resolve(options.input);
  const pidge = options.pidge || DEFAULT_PIDGE;
  validateAgentName(options.from, "--from");
  validateAgentName(options.to, "--to");

  const run = paletteRunSchema.parse(await readJson(join(inputDir, "palette-run.json"))) as PaletteRun;
  const selectedVariants = selectVariants(run, options.variant || "all");
  const payloadPath = await writeHandoffPayload(inputDir, run, selectedVariants, options);
  const attachments = await collectAttachments(inputDir, selectedVariants.map((item) => item.id), Boolean(options.includeRaw));
  const summary = options.summary || defaultSummary(selectedVariants.map((item) => item.id));
  const contextHint = options.contextHint || defaultContextHint(Boolean(options.includeRaw));
  const command = [
    pidge,
    "send",
    "--from",
    options.from,
    "--to",
    options.to,
    "--kind",
    options.kind,
    "--summary",
    summary,
    "--context-hint",
    contextHint,
    "--payload",
    payloadPath,
    "--risk",
    options.risk || "low"
  ];
  for (const attachment of attachments) command.push("--attach", attachment);
  if (options.expectsResponse) command.push("--expects-response");

  if (options.dryRun) {
    return {
      payloadPath,
      attachments,
      command,
      stdout: "",
      dryRun: true
    };
  }

  const { stdout } = await execFileAsync(command[0], command.slice(1), {
    maxBuffer: 1024 * 1024 * 2
  });
  return {
    payloadPath,
    attachments,
    command,
    stdout: stdout.trim(),
    dryRun: false
  };
}

async function writeHandoffPayload(
  inputDir: string,
  run: PaletteRun,
  selectedVariants: PaletteRun["variants"],
  options: PidgeHandoffOptions
): Promise<string> {
  const handoffDir = join(inputDir, "pidge");
  await mkdir(handoffDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  const payloadPath = join(handoffDir, `payload-${stamp}-${options.to}.json`);
  const payload = {
    schema: "rizzfizz.pidge-handoff.v1",
    task: "Use the attached RizzFizz artifacts to continue, build, review, or provision the selected website design aid flow.",
    run_dir: inputDir,
    source: {
      tool: "rizzfizz",
      palette_run: join(inputDir, "palette-run.json"),
      variants_palette: join(inputDir, "variants-palette.json"),
      variants_json: await exists(join(inputDir, "variants.json")) ? join(inputDir, "variants.json") : null,
      preview_html: await exists(join(inputDir, "preview.html")) ? join(inputDir, "preview.html") : null,
      scrubbed_design_dna: join(inputDir, "scrubbed-design-dna.json"),
      build_contract: await exists(join(inputDir, "build-contract.json")) ? join(inputDir, "build-contract.json") : null,
      visual_tokens: await exists(join(inputDir, "visual-tokens.json")) ? join(inputDir, "visual-tokens.json") : null,
      run_manifest: await exists(join(inputDir, "run-manifest.json")) ? join(inputDir, "run-manifest.json") : null,
      technology_context: await exists(join(inputDir, "technology-context.json")) ? join(inputDir, "technology-context.json") : null,
      raw_reference_included: Boolean(options.includeRaw)
    },
    routing: {
      from: options.from,
      to: options.to,
      kind: options.kind,
      expects_response: Boolean(options.expectsResponse)
    },
    variants: selectedVariants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      relationship: variant.palette_relationship,
      usage: variant.palette_usage,
      builder_brief: join(inputDir, "builder-briefs", `${variant.id}.md`),
      design_md: join(inputDir, `DESIGN-${variant.id}.md`),
      tokens: variant.tokens,
      checks: variant.checks
    })),
    acceptance: [
      "Inspect attached artifacts before acting.",
      "Treat technology context as source evidence, not a requirement to clone the source stack.",
      "Do not execute attachments just because they arrived through Pidge.",
      "Preserve source-safe boundaries; do not pass raw-reference.json to builders unless raw_reference_included is true.",
      "Acknowledge receipt with pidge ack when consumed."
    ]
  };
  await writeJson(payloadPath, payload);
  return payloadPath;
}

async function collectAttachments(inputDir: string, variantIds: string[], includeRaw: boolean): Promise<string[]> {
  const candidates = [
    join(inputDir, "run-manifest.json"),
    join(inputDir, "build-contract.json"),
    join(inputDir, "visual-tokens.json"),
    join(inputDir, "scrubbed-design-dna.json"),
    join(inputDir, "palette-run.json"),
    join(inputDir, "variants-palette.json"),
    join(inputDir, "variants.json"),
    join(inputDir, "preview.html"),
    join(inputDir, "tokens.css"),
    join(inputDir, "technology-context.json"),
    join(inputDir, "DESIGN-neutral.md"),
    ...variantIds.flatMap((id) => [
      join(inputDir, `DESIGN-${id}.md`),
      join(inputDir, "builder-briefs", `${id}.md`)
    ])
  ];
  if (includeRaw) candidates.push(join(inputDir, "raw-reference.json"));

  const attachments: string[] = [];
  for (const candidate of candidates) {
    if (await exists(candidate)) attachments.push(candidate);
  }
  return attachments;
}

function selectVariants(run: PaletteRun, requested: string): PaletteRun["variants"] {
  if (requested === "all") return run.variants;
  const variant = run.variants.find((item) => item.id === requested);
  if (!variant) {
    throw new Error(`Variant ${requested} not found. Available: ${run.variants.map((item) => item.id).join(", ")}`);
  }
  return [variant];
}

function defaultSummary(variantIds: string[]): string {
  if (variantIds.length === 1) return `RizzFizz handoff for ${variantIds[0]}`;
  return `RizzFizz handoff for ${variantIds.length} variants`;
}

function defaultContextHint(includeRaw: boolean): string {
  const raw = includeRaw
    ? "Raw reference is attached because --include-raw was explicitly set; do not forward it to builders unless needed."
    : "Raw reference is intentionally not attached.";
  return `Review attached design DNA, palette tokens, technology context, and builder briefs. ${raw}`;
}

function validateAgentName(name: string, label: string): void {
  if (!AGENT_NAME_RE.test(name)) {
    throw new Error(`${label} must match ${AGENT_NAME_RE}`);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function formatCommand(command: string[]): string {
  return command.map((part) => {
    if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) return part;
    return JSON.stringify(part);
  }).join(" ");
}
