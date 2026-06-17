import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import zlib from "node:zlib";
import test from "node:test";

import { extractPaletteColorsFromAEyesArtifact } from "../dist/palette-analysis.js";
import { buildDesignScoreReport } from "../dist/design-score.js";

const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;

const HTML = `<main class="grid gap-6 p-8 bg-[#081117] text-[#f6fafc]"><button class="rounded-lg bg-[#20a8f7] px-4 py-2">Act</button></main>`;
const CSS = `:root { --color-bg: #081117; --color-text: #f6fafc; --color-accent: #20a8f7; --color-border: #29404f; }
.card { background: #10202a; color: var(--color-text); border: 1px solid var(--color-border); }`;

test("extractPaletteColorsFromAEyesArtifact ingests source-safe a-eyes JSON palette artifacts", () => {
  const colors = extractPaletteColorsFromAEyesArtifact({
    json: {
      screenshot_path: "/private/reference-site/home.png",
      pixel_diff: {
        dominant_colors: [
          { hex: "#081117", pixels: 1200, role: "background" },
          { color: "rgb(246, 250, 252)", count: 900, role: "text" },
          { value: "#20a8f7", coverage: 0.12, role: "accent" }
        ]
      }
    }
  });

  assert.ok(colors.some((color) => color.hex === "#081117" && color.source_kind === "a-eyes-json" && color.count === 1200));
  assert.ok(colors.some((color) => color.hex === "#F6FAFC" && color.role === "text"));
  assert.ok(colors.some((color) => color.hex === "#20A8F7" && color.role === "accent"));
  assert.equal(JSON.stringify(colors).includes("/private/reference-site"), false);
});

test("extractPaletteColorsFromAEyesArtifact derives dominant colors from simple PNG captures", () => {
  const png = makePng(2, 2, [
    [8, 17, 23, 255], [8, 17, 23, 255],
    [246, 250, 252, 255], [32, 168, 247, 255]
  ]);
  const colors = extractPaletteColorsFromAEyesArtifact({ png });

  assert.equal(colors[0].hex, "#081117");
  assert.equal(colors[0].count, 2);
  assert.ok(colors.some((color) => color.hex === "#F6FAFC"));
  assert.ok(colors.some((color) => color.hex === "#20A8F7"));
  assert.ok(colors.every((color) => color.source_kind === "a-eyes-png"));
});

test("buildDesignScoreReport emits report-card grade, strengths, warnings, and combined safe guidance", () => {
  const report = buildDesignScoreReport({
    html: HTML,
    css: CSS,
    aEyesJson: {
      dominant_colors: ["#081117", "#10202a", "#f6fafc", "#20a8f7", "#29404f"]
    },
    styleText: "Product-clear bento dashboard with modular cells, strict hierarchy, controlled density, and restrained accents."
  });

  assert.equal(report.schema, "rizzfizz.design-score-report.v1");
  assert.equal(report.source_safe, true);
  assert.match(report.report_card.grade, /^[A-F][+-]?$/);
  assert.ok(report.report_card.score >= 70);
  assert.ok(report.report_card.strengths.some((item) => /contrast|coverage|archetype|style/i.test(item)));
  assert.ok(report.safe_variation_constraints.locked.length > 0);
  assert.ok(report.safe_variation_constraints.verify.some((item) => /contrast|visual diff|screenshot|palette/i.test(item)));
  assert.match(report.exportable_guidance.markdown, /Palette \+ Archetype Guidance/);
  assert.match(report.exportable_guidance.markdown, /Do not clone/i);
});

test("design-score CLI writes exportable source-safe guidance artifact from CSS, HTML, and a-eyes artifacts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-design-score-"));
  try {
    const htmlPath = join(dir, "sample.html");
    const cssPath = join(dir, "sample.css");
    const artifactPath = join(dir, "a-eyes-palette.json");
    const pngPath = join(dir, "capture.png");
    const out = join(dir, "design-score.json");
    await writeFile(htmlPath, HTML);
    await writeFile(cssPath, CSS);
    await writeFile(artifactPath, JSON.stringify({ dominant_colors: ["#081117", "#10202a", "#f6fafc", "#20a8f7", "#29404f"] }));
    await writeFile(pngPath, makePng(1, 2, [[8, 17, 23, 255], [246, 250, 252, 255]]));

    const { stdout } = await execFileAsync("node", [cli, "design-score", "--html", htmlPath, "--css", cssPath, "--a-eyes-json", artifactPath, "--a-eyes-png", pngPath, "--style-text", "product clear bento modular cells", "--out", out]);
    const report = JSON.parse(await readFile(out, "utf8"));

    assert.match(stdout, /Wrote design score:/);
    assert.equal(report.schema, "rizzfizz.design-score-report.v1");
    assert.equal(report.source_safe, true);
    assert.equal(report.inputs.html, "redacted-local-path");
    assert.equal(report.inputs.css, "redacted-local-path");
    assert.equal(report.inputs.a_eyes_json, "redacted-local-path");
    assert.equal(report.inputs.a_eyes_png, "redacted-local-path");
    assert.ok(report.exportable_guidance.json.palette_constraints.length > 0);
    assert.equal(JSON.stringify(report).includes(dir), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function makePng(width, height, pixels) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x += 1) {
      const src = pixels[y * width + x];
      const offset = y * (1 + width * 4) + 1 + x * 4;
      raw.set(src, offset);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
