#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const cli = join(repoRoot, "bin", "cli.js");

const options = parseArgs(process.argv.slice(2));
const briefWeaverRoot = resolve(options.briefWeaverRoot || "/Users/max/Documents/Code/brief-weaver");
const briefWeaverOut = resolve(options.briefWeaverOut || "/tmp/brief-weaver-contract-smoke");
const briefWeaverRun = resolve(options.briefWeaverRun || join(briefWeaverOut, "brief-smoke"));
const outDir = resolve(options.out || "/tmp/rizzfizz-briefweaver-aeyes-sample");
const recipient = options.to || "a-eyes";

if (!options.briefWeaverRun) {
  await runCommand("brief-weaver-smoke", "bash", [join(briefWeaverRoot, "scripts", "smoke_briefweaver.sh"), briefWeaverOut], {
    cwd: briefWeaverRoot
  });
}

await ensureFrozenBriefWeaverRun(briefWeaverRun);
await rm(outDir, { recursive: true, force: true });

await runCli("import-brief-weaver", [
  "import-brief-weaver",
  "--input",
  briefWeaverRun,
  "--out",
  outDir
]);

await ensureRizzFizzRun(outDir);
await ensureNoLegacyAEyesShim(outDir);

await runCli("handoff", [
  "handoff",
  "--input",
  outDir,
  "--to",
  recipient,
  "--from",
  "codex",
  "--kind",
  "rizzfizz-briefweaver-a-eyes-intake",
  "--variant",
  "all",
  "--dry-run"
]);

await ensureDryRunHandoff(outDir, recipient);
await assertSourceSafe(outDir);

console.log(`Brief Weaver run: ${briefWeaverRun}`);
console.log(`RizzFizz run: ${outDir}`);
console.log(`Preview: ${join(outDir, "preview.html")}`);
console.log(`Intake variants: ${join(outDir, "variants.json")}`);
console.log(`Dry-run handoff payloads: ${join(outDir, "pidge")}`);

async function runCli(label, args) {
  await runCommand(label, process.execPath, [cli, ...args], { cwd: repoRoot });
}

async function runCommand(label, command, args, execOptions = {}) {
  console.log(`$ ${formatCommand([command, ...args])}`);
  const { stdout, stderr } = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 8,
    ...execOptions
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  console.log(`ok: ${label}`);
}

async function ensureFrozenBriefWeaverRun(runDir) {
  const required = [
    "variation-manifest.json",
    "project-brief.json",
    "handoff/briefweaver-project-brief.json",
    "scrubbed/DESIGN-neutral.md",
    "scrubbed/scrubbed-design-dna.json",
    "variants/variants.json",
    "palettes/palette-run.json"
  ];
  for (const relative of required) await ensureFile(join(runDir, relative), `Brief Weaver contract file ${relative}`);

  const variantFiles = (await readdir(join(runDir, "variants"))).filter((name) => /^DESIGN-variant-.+\.md$/.test(name));
  if (variantFiles.length === 0) throw new Error(`Missing Brief Weaver variant files: ${join(runDir, "variants", "DESIGN-variant-*.md")}`);

  const projectBrief = JSON.parse(await readFile(join(runDir, "project-brief.json"), "utf8"));
  const handoffBrief = JSON.parse(await readFile(join(runDir, "handoff", "briefweaver-project-brief.json"), "utf8"));
  for (const [label, brief] of [["project-brief.json", projectBrief], ["handoff/briefweaver-project-brief.json", handoffBrief]]) {
    if (brief.schemaVersion !== "briefweaver.project-brief.v1") throw new Error(`${label} has unsupported schemaVersion`);
    if (brief.source_safe !== true) throw new Error(`${label} must be source_safe: true`);
    if (brief.rizzfizz_import?.input_schema !== "briefweaver.project-brief.v1") {
      throw new Error(`${label} must declare rizzfizz_import.input_schema briefweaver.project-brief.v1`);
    }
  }
}

async function ensureRizzFizzRun(runDir) {
  const required = [
    "run-manifest.json",
    "build-contract.json",
    "visual-tokens.json",
    "scrubbed-design-dna.json",
    "palette-run.json",
    "variants-palette.json",
    "variants.json",
    "preview.html",
    "DESIGN-neutral.md",
    "raw-reference.json"
  ];
  for (const relative of required) await ensureFile(join(runDir, relative), `RizzFizz artifact ${relative}`);

  const variants = JSON.parse(await readFile(join(runDir, "variants.json"), "utf8"));
  if (variants.shared_constraints?.a_eyes_required !== true) throw new Error("variants.json is not marked as a-eyes required");
  if (!Array.isArray(variants.variants) || variants.variants.length === 0) throw new Error("variants.json contains no variants");
}

async function ensureNoLegacyAEyesShim(runDir) {
  for (const relative of ["brief.raw.txt", "brief.structured.json"]) {
    try {
      await stat(join(runDir, relative));
      throw new Error(`RizzFizz canonical output must not include legacy a-eyes shim file: ${relative}`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
}

async function ensureDryRunHandoff(runDir, recipientName) {
  const pidgeDir = join(runDir, "pidge");
  const payloadFiles = (await readdir(pidgeDir)).filter((name) => name.endsWith(`-${recipientName}.json`));
  if (payloadFiles.length === 0) throw new Error(`No dry-run handoff payload found in ${pidgeDir}`);
  const payload = JSON.parse(await readFile(join(pidgeDir, payloadFiles[0]), "utf8"));
  if (payload.routing?.kind !== "rizzfizz-briefweaver-a-eyes-intake") throw new Error("Unexpected handoff kind");
  if (payload.source?.raw_reference_included !== false) throw new Error("Raw reference must not be included in default handoff");
  if (!payload.source?.variants_json || !payload.source?.preview_html) throw new Error("Handoff must include variants.json and preview.html pointers");
}

async function assertSourceSafe(runDir) {
  const forbidden = [
    "https://quiet-gallery.example/showcase",
    "https://north-pier-editorial.example/work",
    "Quiet Gallery",
    "North Pier Editorial",
    "quiet-gallery.example",
    "north-pier-editorial.example",
    "Framer",
    "Webflow",
    "#05070b",
    "#07101c",
    "#38bdf8"
  ];
  const publicFiles = [
    "run-manifest.json",
    "build-contract.json",
    "visual-tokens.json",
    "scrubbed-design-dna.json",
    "palette-run.json",
    "variants-palette.json",
    "variants.json",
    "preview.html",
    "DESIGN-neutral.md"
  ];
  const variantDir = join(runDir, "builder-briefs");
  const builderBriefs = (await readdir(variantDir)).filter((name) => name.endsWith(".md")).map((name) => join("builder-briefs", name));
  for (const relative of [...publicFiles, ...builderBriefs]) {
    const text = await readFile(join(runDir, relative), "utf8");
    for (const term of forbidden) {
      if (text.includes(term)) throw new Error(`Source identity leaked into ${relative}: ${term}`);
    }
  }
}

async function ensureFile(path, label) {
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`${label} is not a file: ${path}`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing ${label}: ${path}`);
    }
    throw error;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["--brief-weaver-root", "--brief-weaver-out", "--brief-weaver-run", "--out", "--to"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      parsed[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage: node scripts/run-briefweaver-import-sample.mjs [options]",
        "",
        "Options:",
        "  --brief-weaver-root <dir>   Brief Weaver repo root",
        "  --brief-weaver-out <dir>    Temp output passed to Brief Weaver smoke script",
        "  --brief-weaver-run <dir>    Existing frozen Brief Weaver run folder",
        "  --out <dir>                 RizzFizz output run directory",
        "  --to <agent>                Dry-run handoff recipient"
      ].join("\n"));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function formatCommand(command) {
  return command.map((part) => {
    if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) return part;
    return JSON.stringify(part);
  }).join(" ");
}
