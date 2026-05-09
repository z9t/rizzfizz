import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;
const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;
const waffleFixture = new URL("./fixtures/waffle-scan.json", import.meta.url).pathname;

test("palette command writes palette-run JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const out = join(dir, "palette-run.json");
    await execFileAsync("node", [cli, "palette", "--relationship", "dark-sparse-accent", "--hue", "blue", "--variants", "3", "--out", out]);
    const run = JSON.parse(await readFile(out, "utf8"));
    assert.equal(run.schema, "rizzfizz.palette-run.v1");
    assert.equal(run.variants.length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scrub-md writes private and builder-facing artifacts without source identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", dir]);
    const raw = JSON.parse(await readFile(join(dir, "raw-reference.json"), "utf8"));
    const dna = await readFile(join(dir, "scrubbed-design-dna.json"), "utf8");
    const contract = JSON.parse(await readFile(join(dir, "build-contract.json"), "utf8"));
    const visualTokens = JSON.parse(await readFile(join(dir, "visual-tokens.json"), "utf8"));
    const manifest = JSON.parse(await readFile(join(dir, "run-manifest.json"), "utf8"));
    const contractText = JSON.stringify(contract);
    const brief = await readFile(join(dir, "builder-briefs", "variant-1.md"), "utf8");
    const variants = JSON.parse(await readFile(join(dir, "variants-palette.json"), "utf8"));

    assert.equal(raw.raw_text.includes("https://acme.example.com/aurora"), true);
    assert.equal(dna.includes("https://acme.example.com/aurora"), false);
    assert.equal(contract.schema, "rizzfizz.build-contract.v1");
    assert.equal(contract.source_safe, true);
    assert.equal(contractText.includes("https://acme.example.com/aurora"), false);
    assert.equal(contractText.includes("Acme"), false);
    assert.equal(contractText.includes("recreate"), false);
    assert.ok(contract.intent.primary_job);
    assert.ok(contract.layout.regions.length >= 3);
    assert.ok(contract.motion.patterns.length >= 3);
    assert.ok(contract.visual_qa.fail_if.length >= 3);
    assert.equal(visualTokens.schema, "rizzfizz.visual-tokens.v1");
    assert.equal(visualTokens.variants.length, 2);
    assert.ok(visualTokens.variants[0].actions.focus_ring);
    assert.ok(visualTokens.variants[0].data_viz.categorical.length >= 6);
    assert.equal(manifest.schema, "rizzfizz.run-manifest.v1");
    assert.match(manifest.recommended_start, /build-contract\.json$/);
    assert.match(brief, /Implementation Contract/);
    assert.match(brief, /Motion Contract/);
    assert.match(brief, /Visual QA/);
    assert.equal(brief.includes("Acme"), false);
    assert.equal(brief.includes("recreate"), false);
    assert.equal(variants.variants.length, 2);
    assert.ok(variants.variants[0].palette_tokens.paper);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspect command prints a compact run summary", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", dir]);
    const { stdout } = await execFileAsync("node", [cli, "inspect", "--input", dir]);
    assert.match(stdout, /RizzFizz run:/);
    assert.match(stdout, /Recommended start:/);
    assert.match(stdout, /Site type:/);
    assert.match(stdout, /Visual token variants: 2/);
    assert.match(stdout, /Motion level:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export commands write a-eyes tokens, CSS vars, and agent briefs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", join(dir, "run")]);
    await execFileAsync("node", [cli, "export", "--format", "a-eyes-variant-tokens", "--input", join(dir, "run", "palette-run.json"), "--out", join(dir, "aeyes.json")]);
    await execFileAsync("node", [cli, "export", "--format", "css-vars", "--input", join(dir, "run", "palette-run.json"), "--out", join(dir, "tokens.css")]);
    await execFileAsync("node", [cli, "export", "--format", "agent-brief", "--input", join(dir, "run"), "--out", join(dir, "briefs")]);

    const aeyes = JSON.parse(await readFile(join(dir, "aeyes.json"), "utf8"));
    const css = await readFile(join(dir, "tokens.css"), "utf8");
    const brief = await readFile(join(dir, "briefs", "variant-1.md"), "utf8");

    assert.equal(aeyes.schema, "rizzfizz.a-eyes-variant-tokens.v1");
    assert.match(css, /--paper:/);
    assert.match(brief, /Quality Bar/);
    assert.match(brief, /Implementation Contract/);
    assert.match(brief, /Component Contract/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("tech-scan summarizes Whiffler JSON and scrub-md carries it into briefs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const techContextPath = join(dir, "technology-context.json");
    await execFileAsync("node", [cli, "tech-scan", "--input", waffleFixture, "--out", techContextPath]);
    const techContext = JSON.parse(await readFile(techContextPath, "utf8"));
    assert.equal(techContext.schema, "rizzfizz.technology-context.v1");
    assert.equal(techContext.detected[0].name, "Next.js");

    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "1", "--tech-scan", waffleFixture, "--out", join(dir, "run")]);
    const runTechContext = JSON.parse(await readFile(join(dir, "run", "technology-context.json"), "utf8"));
    const brief = await readFile(join(dir, "run", "builder-briefs", "variant-1.md"), "utf8");
    assert.equal(runTechContext.detected[0].name, "Next.js");
    assert.match(brief, /Detected Source Technology Context/);
    assert.match(brief, /Waffle Whiffler/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("handoff writes a Pidge payload in dry-run mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", join(dir, "run")]);
    const { stdout } = await execFileAsync("node", [
      cli,
      "handoff",
      "--input",
      join(dir, "run"),
      "--to",
      "gemma",
      "--variant",
      "variant-1",
      "--dry-run",
      "--pidge",
      "/Users/max/Documents/Code/pidge/pidge"
    ]);
    assert.match(stdout, /Wrote pidge payload:/);
    assert.match(stdout, /pidge send/);
    assert.match(stdout, /--attach/);

    const payloadPath = stdout.match(/Wrote pidge payload: (.+)/)?.[1].trim();
    assert.ok(payloadPath);
    const payload = JSON.parse(await readFile(payloadPath, "utf8"));
    assert.equal(payload.schema, "rizzfizz.pidge-handoff.v1");
    assert.equal(payload.variants.length, 1);
    assert.equal(payload.variants[0].id, "variant-1");
    assert.match(payload.source.build_contract, /build-contract\.json$/);
    assert.match(payload.source.visual_tokens, /visual-tokens\.json$/);
    assert.match(payload.source.run_manifest, /run-manifest\.json$/);
    assert.equal(payload.source.raw_reference_included, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("handoff can send through real pidge into an isolated bus root", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  const busRoot = join(dir, "bus");
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "1", "--out", join(dir, "run")]);
    const { stdout } = await execFileAsync("node", [
      cli,
      "handoff",
      "--input",
      join(dir, "run"),
      "--to",
      "gemma",
      "--from",
      "codex",
      "--variant",
      "variant-1",
      "--pidge",
      "/Users/max/Documents/Code/pidge/pidge",
      "--expects-response"
    ], {
      env: { ...process.env, PIDGE_ROOT: busRoot }
    });
    assert.match(stdout, /msg_/);

    const { stdout: inbox } = await execFileAsync("/Users/max/Documents/Code/pidge/pidge", ["list", "--for", "gemma"], {
      env: { ...process.env, PIDGE_ROOT: busRoot }
    });
    assert.match(inbox, /msg_/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
