import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { writeStudioPreview } from "../dist/studio-preview.js";

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

test("writeStudioPreview embeds menubar, VAR chips, and interaction log hooks", async () => {
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
  assert.match(html, /rizzfizz\.studio-preview\.v1/);
  assert.match(html, /class="rf-bar top"/);
  assert.match(html, /class="rf-bar bottom"/);
  assert.match(html, /North Pier/);
  assert.match(html, /data-act="fav"/);
  assert.match(html, /data-act="client"/);
  assert.match(html, /data-act="reriff"/);
  assert.match(html, /data-act="notes"/);
  assert.match(html, /design-system-override/);
  assert.match(html, /rizzfizz-studio-interactions-/);
  assert.match(html, /VAR-1/);
  assert.match(html, /OKLCH/);
  assert.match(html, /btn-pull-copy/);
  assert.match(html, /INSP-VALUE|example\.com/);
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

test("pull --insp writes manifest with status probe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-pull-"));
  // Use a data-less local file URL via httpbin if available is flaky; instead
  // probe a guaranteed-fail host and still require a manifest.
  await execFileAsync("node", [
    cli, "pull",
    "--out", dir,
    "--insp", "https://example.invalid/"
  ]);
  const manifest = JSON.parse(await readFile(join(dir, "pull-manifest.json"), "utf8"));
  assert.equal(manifest.schema, "rizzfizz.pull.v1");
  assert.ok(manifest.insp);
  assert.equal(manifest.insp.url, "https://example.invalid/");
});
