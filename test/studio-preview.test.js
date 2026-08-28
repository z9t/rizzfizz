import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { pullAssets } from "../dist/pull.js";
import { writeStudioPreview } from "../dist/studio-preview.js";
import { writeTokensHandoff } from "../dist/tokens-handoff.js";

const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;

const minimalPaletteRun = {
  schema: "rizzfizz.palette-run.v1",
  created_at: "2026-08-01T00:00:00.000Z",
  relationship: "dark-sparse-accent",
  hue_family: "blue",
  source: "test",
  variants: [
    {
      id: "v1",
      name: "Sparse Blue",
      tokens: {
        paper: "#0F1419",
        panel: "#1A222C",
        ink: "#E8EEF4",
        muted: "#8A96A3",
        accent: "#3D7CFF",
        accent_strong: "#1F4FD6",
        line: "#2A3440"
      },
      palette_relationship: {
        tone: "dark",
        accent_usage: "sparse",
        chroma: "controlled",
        contrast: "high",
        relationship: "dark-sparse-accent"
      },
      palette_usage: "test",
      checks: { contrast: [], warnings: [], failures: [] }
    },
    {
      id: "v2",
      name: "Cool Shift",
      tokens: {
        paper: "#101418",
        panel: "#1B232B",
        ink: "#E7EDF2",
        muted: "#87939F",
        accent: "#2BB3C0",
        accent_strong: "#1A8A94",
        line: "#2B353E"
      },
      palette_relationship: {
        tone: "dark",
        accent_usage: "sparse",
        chroma: "controlled",
        contrast: "high",
        relationship: "dark-sparse-accent"
      },
      palette_usage: "test",
      checks: { contrast: [], warnings: [], failures: [] }
    }
  ]
};

test("writeStudioPreview: pencil edit-mode, 5 umbrellas, no per-field Edit buttons", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-studio-"));
  const input = join(dir, "palette-run.json");
  const out = join(dir, "studio.html");
  await writeFile(input, JSON.stringify(minimalPaletteRun), "utf8");

  await writeStudioPreview({
    input,
    out,
    siteName: "North Pier",
    pageName: "home",
    insp: "example.com",
    bar: "both"
  });

  const html = await readFile(out, "utf8");
  const payload = JSON.parse(html.match(/id="rf-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(payload.models.length, 5);
  assert.ok(payload.models.every((m) => [
    "swiss-international", "bento-grid", "neo-minimalism", "neo-brutalism", "maximalism"
  ].includes(m.id)));
  assert.equal(html.includes("data-edit-btn"), false);
  assert.equal(html.includes(">Edit</"), false);
  assert.match(html, /data-act="edit"/);
  assert.match(html, /body\.edit-mode/);
  assert.match(html, /class="cms"/);
  assert.match(html, /Backup JSON/);
  assert.match(html, /design-system-override/);
  assert.match(html, /Five umbrella systems/);
  assert.match(html, /data-act="fav"/);
  assert.match(html, /VAR-1/);
  assert.match(html, /OKLCH/);
  assert.match(html, /North Pier/);
  assert.match(html, /example\.com/);
  assert.equal(payload.design_system.includes("riff"), false);
});

test("writeStudioPreview prefers --body/--footer and writes prompt-copy.json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-studio-body-"));
  const input = join(dir, "palette-run.json");
  const out = join(dir, "studio.html");
  await writeFile(input, JSON.stringify(minimalPaletteRun), "utf8");

  await writeStudioPreview({
    input,
    out,
    siteName: "North Pier",
    body: "Manual pier body for prompts.",
    footer: "Manual pier footer."
  });

  const html = await readFile(out, "utf8");
  assert.match(html, /Manual pier body for prompts\./);
  assert.match(html, /Manual pier footer\./);
  const prompt = JSON.parse(await readFile(join(dir, "prompt-copy.json"), "utf8"));
  assert.equal(prompt.schema, "rizzfizz.prompt-copy.v1");
  assert.equal(prompt.body, "Manual pier body for prompts.");
  assert.equal(prompt.footer, "Manual pier footer.");
});

test("studio loads pulled-copy.json from run pull/", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-studio-pullcopy-"));
  const input = join(dir, "palette-run.json");
  const out = join(dir, "studio.html");
  await writeFile(input, JSON.stringify(minimalPaletteRun), "utf8");
  await mkdir(join(dir, "pull"), { recursive: true });
  await writeFile(join(dir, "pull", "pulled-copy.json"), JSON.stringify({
    schema: "rizzfizz.page-copy.v1",
    site_name: "Pulled Pier",
    eyebrow: "From site",
    sub: "Harbour light",
    h2: "About",
    body: "Pulled body from the original site scan.",
    footer: "Pulled footer line.",
    paragraphs: ["Pulled body from the original site scan."]
  }), "utf8");

  await writeStudioPreview({ input, out });
  const html = await readFile(out, "utf8");
  assert.match(html, /Pulled body from the original site scan\./);
  assert.match(html, /Pulled footer line\./);
  assert.match(html, /Harbour light/);
});

test("scrub-md --insp/--copy without --studio does not write studio.html", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-scrub-nostudio-"));
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html><head><title>X</title></head><body><p>Hello long enough copy for pull.</p></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;
  const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;
  try {
    await execFileAsync("node", [
      cli, "scrub-md",
      "--input", fixture,
      "--out", dir,
      "--variants", "2",
      "--insp", url,
      "--copy", url
    ], { env: { ...process.env, RIZZFIZZ_PULL_TIMEOUT_MS: "2000" } });
    await assert.rejects(() => access(join(dir, "studio.html")));
    const pull = JSON.parse(await readFile(join(dir, "pull", "pull-manifest.json"), "utf8"));
    assert.equal(pull.schema, "rizzfizz.pull.v1");
  } finally {
    server.close();
  }
});

test("scrub-md --insp/--copy/--studio pulls site copy into studio in one shot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-scrub-studio-"));
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><html><head><title>Harbour Co</title>
<meta name="description" content="Quiet harbour work.">
</head><body><h1>Harbour Co</h1><h2>About the pier</h2>
<p>This is a long enough paragraph from the scanned site so studio body is real content not a placeholder filler string.</p>
<footer>Harbour Co · Est. 1998 · All rights reserved</footer></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;
  const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;
  try {
    await execFileAsync("node", [
      cli, "scrub-md",
      "--input", fixture,
      "--out", dir,
      "--variants", "2",
      "--insp", url,
      "--copy", url,
      "--studio",
      "--site-name", "Harbour Co"
    ], { env: { ...process.env, RIZZFIZZ_PULL_TIMEOUT_MS: "2000" } });
    const html = await readFile(join(dir, "studio.html"), "utf8");
    assert.match(html, /scanned site so studio body is real/);
    assert.match(html, /Harbour Co · Est\. 1998/);
    assert.match(html, /data-act="edit"/);
    const prompt = JSON.parse(await readFile(join(dir, "prompt-copy.json"), "utf8"));
    assert.match(prompt.body, /scanned site so studio body is real/);
  } finally {
    server.close();
  }
});

test("export tokens-handoff and handoff --tokens-only --dry-run omit HTML", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-tokens-"));
  await writeFile(join(dir, "palette-run.json"), JSON.stringify(minimalPaletteRun), "utf8");
  const out = join(dir, "tokens-handoff.json");
  await writeTokensHandoff(dir, out);
  const tokens = JSON.parse(await readFile(out, "utf8"));
  assert.equal(tokens.schema, "rizzfizz.tokens-handoff.v1");
  assert.equal(tokens.design_systems.length, 5);
  assert.ok(tokens.variants[0].tokens.paper);

  await execFileAsync("node", [
    cli, "export",
    "--format", "tokens-handoff",
    "--input", dir,
    "--out", join(dir, "via-cli.json")
  ]);
  const viaCli = JSON.parse(await readFile(join(dir, "via-cli.json"), "utf8"));
  assert.equal(viaCli.schema, "rizzfizz.tokens-handoff.v1");

  const { stdout } = await execFileAsync("node", [
    cli, "handoff",
    "--input", dir,
    "--to", "gemma",
    "--dry-run",
    "--tokens-only"
  ]);
  assert.match(stdout, /tokens-only|tokens-handoff|payload-tokens/i);
  assert.equal(stdout.includes("preview.html"), false);
});

test("studio CLI writes HTML from palette-run", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-studio-cli-"));
  const input = join(dir, "palette-run.json");
  const out = join(dir, "studio.html");
  await writeFile(input, JSON.stringify(minimalPaletteRun), "utf8");

  await execFileAsync("node", [
    cli, "studio",
    "--input", input,
    "--out", out,
    "--site-name", "Quiet Studio",
    "--bar", "top"
  ]);

  const html = await readFile(out, "utf8");
  assert.match(html, /Quiet Studio/);
  assert.match(html, /class="rf-bar top"/);
  assert.equal(html.includes('class="rf-bar bottom"'), false);
});

test("pullAssets (--insp/--copy) writes manifest + copy for scrub-md", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-pull-"));
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html><head><title>Pull Fixture</title></head><body><p>Hello pier</p></body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;
  try {
    process.env.RIZZFIZZ_PULL_TIMEOUT_MS = "2000";
    const result = await pullAssets({ out: dir, insp: url, copy: url });
    assert.equal(result.schema, "rizzfizz.pull.v1");
    assert.equal(result.insp.status, 200);
    assert.equal(result.insp.title, "Pull Fixture");
    assert.ok(result.copy.chars > 0);
    const copy = await readFile(result.copy.text_path, "utf8");
    assert.match(copy, /Hello pier/);
  } finally {
    server.close();
  }
});
