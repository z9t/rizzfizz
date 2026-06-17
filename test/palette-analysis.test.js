import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  analyzePaletteFromSource,
  extractPaletteColorsFromSource,
  scorePaletteQuality
} from "../dist/palette-analysis.js";

const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;

const SAMPLE = `
:root {
  --color-bg: #081117;
  --color-surface: oklch(22% 0.025 230);
  --color-text: rgb(246 250 252);
  --color-muted: #9db0ba;
  --color-brand-accent: hsl(205 90% 56%);
  --color-border: color-mix(in oklch, var(--color-text) 18%, transparent);
}
.hero { background: var(--color-bg); color: var(--color-text); border-color: var(--color-border); }
.button { background-color: var(--color-brand-accent); color: #031018; }
<div style="color: var(--color-muted); background: #0f1b22" class="bg-[#081117] text-[#f6fafc]"></div>
`;

test("extractPaletteColorsFromSource resolves CSS custom properties and HTML/class color text", () => {
  const colors = extractPaletteColorsFromSource({ css: SAMPLE, html: SAMPLE });
  const byHex = new Map(colors.map((color) => [color.hex, color]));

  assert.ok(colors.length >= 6);
  assert.ok(byHex.has("#081117"));
  assert.ok(byHex.has("#F6FAFC"));
  assert.ok(colors.some((color) => color.name === "--color-brand-accent" && color.role === "accent"));
  assert.ok(colors.some((color) => color.source_kind === "custom-property"));
  assert.ok(colors.some((color) => color.source_kind === "html-class"));
  assert.equal(colors.some((color) => /hero|button|div/.test(color.evidence || "")), false);
});

test("scorePaletteQuality reports role coverage, contrast signals, and OKLCH foundations", () => {
  const report = analyzePaletteFromSource({ css: SAMPLE, html: SAMPLE });

  assert.equal(report.schema, "rizzfizz.palette-analysis.v1");
  assert.equal(report.source_safe, true);
  assert.ok(report.extracted_colors.length >= 6);
  assert.equal(report.role_coverage.background.present, true);
  assert.equal(report.role_coverage.text.present, true);
  assert.equal(report.role_coverage.accent.present, true);
  assert.equal(report.role_coverage.border.present, true);
  assert.ok(report.role_coverage.score >= 0.8);
  assert.ok(report.contrast.best_text_on_background);
  assert.ok(report.contrast.best_text_on_background.ratio >= 12);
  assert.ok(report.oklch.lightness_range > 0.7);
  assert.ok(report.oklch.max_chroma > 0.1);
  assert.ok(report.oklch.hue_clusters.length >= 1);
  assert.ok(report.quality_score >= 70);
  assert.match(report.summary, /role coverage/i);
});

test("scorePaletteQuality penalizes low-contrast role coverage gaps", () => {
  const weak = scorePaletteQuality(extractPaletteColorsFromSource({ css: `.x { color: #777; background: #888; }` }));

  assert.equal(weak.role_coverage.accent.present, false);
  assert.ok(weak.role_coverage.score < 0.5);
  assert.ok(weak.quality_score < 60);
  assert.ok(weak.warnings.some((warning) => /Missing accent/i.test(warning)));
});

test("palette-analyze CLI writes source-safe palette analysis JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-palette-analysis-"));
  try {
    const htmlPath = join(dir, "sample.html");
    const cssPath = join(dir, "sample.css");
    const out = join(dir, "palette-analysis.json");
    await writeFile(htmlPath, SAMPLE);
    await writeFile(cssPath, SAMPLE);

    const { stdout } = await execFileAsync("node", [cli, "palette-analyze", "--html", htmlPath, "--css", cssPath, "--out", out]);
    const report = JSON.parse(await readFile(out, "utf8"));

    assert.match(stdout, /Wrote palette analysis:/);
    assert.equal(report.schema, "rizzfizz.palette-analysis.v1");
    assert.equal(report.source_safe, true);
    assert.equal(report.inputs.html, "redacted-local-path");
    assert.equal(report.inputs.css, "redacted-local-path");
    assert.ok(report.quality_score >= 70);
    assert.equal(JSON.stringify(report).includes(htmlPath), false);
    assert.equal(JSON.stringify(report).includes(cssPath), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
