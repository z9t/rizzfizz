#!/usr/bin/env node
import { execFile } from "node:child_process";
import { rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const cli = join(repoRoot, "bin", "cli.js");

const options = parseArgs(process.argv.slice(2));
const fixture = resolve(options.fixture || join(repoRoot, "test", "fixtures", "a-eyes-intake", "DESIGN.md"));
const outDir = resolve(options.out || join(repoRoot, "runs", "a-eyes-intake-sample"));
const variants = String(options.variants || "3");

await ensureFile(fixture, "fixture DESIGN.md");
await rm(outDir, { recursive: true, force: true });

await run("scrub-md", [
  "scrub-md",
  "--input",
  fixture,
  "--variants",
  variants,
  "--relationship",
  "gallery-neutral",
  "--hue",
  "green",
  "--out",
  outDir
]);

await run("preview", [
  "preview",
  "--input",
  outDir,
  "--out",
  join(outDir, "preview.html")
]);

await run("export", [
  "export",
  "--format",
  "a-eyes-intake-variants",
  "--input",
  outDir,
  "--out",
  join(outDir, "variants.json")
]);

await run("handoff", [
  "handoff",
  "--input",
  outDir,
  "--to",
  "a-eyes",
  "--from",
  "codex",
  "--kind",
  "rizzfizz-a-eyes-intake",
  "--variant",
  "all",
  "--dry-run"
]);

console.log(`Sample run: ${outDir}`);
console.log(`Preview: ${join(outDir, "preview.html")}`);
console.log(`Intake variants: ${join(outDir, "variants.json")}`);
console.log(`Dry-run handoff payloads: ${join(outDir, "pidge")}`);

async function run(label, args) {
  const command = [process.execPath, cli, ...args];
  console.log(`$ ${formatCommand(command)}`);
  const { stdout, stderr } = await execFileAsync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 8
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  console.log(`ok: ${label}`);
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
    if (arg === "--out" || arg === "--fixture" || arg === "--variants") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      parsed[arg.slice(2)] = value;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/run-aeyes-intake-sample.mjs [--out <dir>] [--fixture <DESIGN.md>] [--variants <n>]`);
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
