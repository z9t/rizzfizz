import { access, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { nearestNamedColors, resolveColorName } from "./color-names.js";
import { contrastRatio, parseHexToOklch } from "./color.js";
import { readJson, writeText } from "./io.js";
import type { BuildContract, PaletteRun, PaletteTokens, RunManifest } from "./types.js";
import type { RiffRun } from "./riff.js";

export type StudioPreviewOptions = {
  input: string;
  out: string;
  siteName?: string;
  pageName?: string;
  insp?: string;
  bar?: "top" | "bottom" | "both";
};

type StudioColor = {
  role: string;
  hex: string;
  name: string;
  oklch: { l: number; c: number; h: number };
  luminance: number;
  contrast_on_paper: number;
  contrast_on_ink: number;
};

type StudioVariant = {
  id: string;
  label: string; // VAR-1 …
  name: string;
  colors: StudioColor[];
  tokens: PaletteTokens;
};

type StudioModel = {
  id: string;
  name: string;
  confidence: number; // 0-1
};

type StudioPayload = {
  schema: "rizzfizz.studio-preview.v1";
  generated_at: string;
  site_name: string;
  page_name: string;
  insp: string;
  scan_date: string;
  design_system: string;
  models: StudioModel[];
  fonts: string[];
  spacing: Record<string, string>;
  variants: StudioVariant[];
  bar: "top" | "bottom" | "both";
  clients: string[];
  collections: string[];
  favourites: string[];
};

export async function writeStudioPreview(options: StudioPreviewOptions): Promise<string> {
  const input = resolve(options.input);
  const outPath = resolve(options.out);
  const payload = await loadStudioPayload(input, options);
  await writeText(outPath, renderStudioHtml(payload));
  return outPath;
}

async function loadStudioPayload(input: string, options: StudioPreviewOptions): Promise<StudioPayload> {
  const bar = options.bar || "both";
  const scanDate = new Date().toISOString();

  if (await isFile(input) && input.endsWith(".json")) {
    const json = await readJson<Record<string, unknown>>(input);
    if (json.schema === "rizzfizz.riff-run.v1") {
      return fromRiff(json as unknown as RiffRun, options, scanDate, bar);
    }
    if (json.schema === "rizzfizz.palette-run.v1" || Array.isArray(json.variants)) {
      return fromPaletteRun(json as unknown as PaletteRun, options, scanDate, bar);
    }
  }

  // Run directory
  const manifestPath = join(input, "run-manifest.json");
  if (await exists(manifestPath)) {
    const manifest = await readJson<RunManifest>(manifestPath);
    const contract = await readJson<BuildContract>(manifest.source_safe_entrypoints.build_contract);
    const paletteRun = await readJson<PaletteRun>(manifest.source_safe_entrypoints.palette_run);
    return fromRun(input, contract, paletteRun, options, scanDate, bar);
  }

  // Bare riff/palette already handled; try palette-run beside input
  const palettePath = join(input, "palette-run.json");
  if (await exists(palettePath)) {
    return fromPaletteRun(await readJson<PaletteRun>(palettePath), options, scanDate, bar);
  }

  throw new Error(`studio preview: unsupported input ${input} (need run dir, palette-run.json, or riff-run.json)`);
}

function fromRun(
  inputDir: string,
  contract: BuildContract,
  paletteRun: PaletteRun,
  options: StudioPreviewOptions,
  scanDate: string,
  bar: StudioPreviewOptions["bar"]
): StudioPayload {
  const primary = contract.design_system_classification.primary;
  const secondary = contract.design_system_classification.secondary;
  const models: StudioModel[] = [
    { id: primary.id, name: primary.name, confidence: clamp01(primary.confidence) }
  ];
  if (secondary) {
    models.push({ id: secondary.id, name: secondary.name, confidence: clamp01(secondary.confidence) });
  }
  normalizeModelConfidences(models);

  const fonts = extractFonts(contract);
  return {
    schema: "rizzfizz.studio-preview.v1",
    generated_at: scanDate,
    site_name: options.siteName || contract.intent.site_type || "INSP-VALUE",
    page_name: options.pageName || basename(inputDir),
    insp: options.insp || "INSP-VALUE",
    scan_date: scanDate,
    design_system: primary.name,
    models,
    fonts,
    spacing: defaultSpacing(),
    variants: paletteRun.variants.map((v, i) => toStudioVariant(v.id, `VAR-${i + 1}`, v.name, v.tokens)),
    bar: bar || "both",
    clients: ["Acme Editorial", "North Pier", "Quiet Studio"],
    collections: ["Photography", "Product UI", "Dark sparse"],
    favourites: ["Saved blues", "Gallery neutrals"]
  };
}

function fromPaletteRun(
  run: PaletteRun,
  options: StudioPreviewOptions,
  scanDate: string,
  bar: StudioPreviewOptions["bar"]
): StudioPayload {
  return {
    schema: "rizzfizz.studio-preview.v1",
    generated_at: scanDate,
    site_name: options.siteName || "INSP-VALUE",
    page_name: options.pageName || "palette",
    insp: options.insp || "INSP-VALUE",
    scan_date: scanDate,
    design_system: run.relationship || "unknown",
    models: [
      { id: run.relationship || "unknown", name: run.relationship || "unknown", confidence: 1 }
    ],
    fonts: ["INSP-VALUE"],
    spacing: defaultSpacing(),
    variants: (run.variants || []).map((v, i) => toStudioVariant(v.id, `VAR-${i + 1}`, v.name, v.tokens)),
    bar: bar || "both",
    clients: [],
    collections: [],
    favourites: []
  };
}

function fromRiff(
  run: RiffRun,
  options: StudioPreviewOptions,
  scanDate: string,
  bar: StudioPreviewOptions["bar"]
): StudioPayload {
  const variants: StudioVariant[] = (run.palettes || []).map((p, i) => {
    const tokens = p.tokens;
    return toStudioVariant(p.id, `VAR-${i + 1}`, p.id, tokens);
  });
  return {
    schema: "rizzfizz.studio-preview.v1",
    generated_at: scanDate,
    site_name: options.siteName || "INSP-VALUE",
    page_name: options.pageName || "riff",
    insp: options.insp || "INSP-VALUE",
    scan_date: scanDate,
    design_system: "riff",
    models: [{ id: "riff", name: "riff", confidence: 1 }],
    fonts: ["INSP-VALUE"],
    spacing: defaultSpacing(),
    variants,
    bar: bar || "both",
    clients: [],
    collections: [],
    favourites: []
  };
}

function toStudioVariant(id: string, label: string, name: string, tokens: PaletteTokens): StudioVariant {
  const paper = tokens.paper;
  const ink = tokens.ink;
  const colors = Object.entries(tokens).map(([role, hex]) => colorMetrics(role, hex, paper, ink));
  return { id, label, name, colors, tokens };
}

function colorMetrics(role: string, hex: string, paper: string, ink: string): StudioColor {
  const o = parseHexToOklch(hex);
  const named = resolveColorName(hex);
  const nearest = nearestNamedColors(hex, 1)[0];
  return {
    role,
    hex: hex.toUpperCase(),
    name: named && named.source !== "hex" ? named.name : nearest?.name || role,
    oklch: { l: Number(o.l.toFixed(4)), c: Number(o.c.toFixed(4)), h: Number(o.h.toFixed(2)) },
    luminance: Number(relativeLuminance(hex).toFixed(4)),
    contrast_on_paper: contrastRatio(hex, paper),
    contrast_on_ink: contrastRatio(hex, ink)
  };
}

function relativeLuminance(hex: string): number {
  const o = parseHexToOklch(hex);
  // OKLCH L is perceptual lightness — good compact metric alongside WCAG
  return o.l;
}

function extractFonts(contract: BuildContract): string[] {
  const evidence = contract.design_system_classification?.source_safe_evidence || [];
  const found: string[] = [];
  for (const line of evidence) {
    const m = line.match(/\b([A-Z][A-Za-z0-9]+(?:\s[A-Z][A-Za-z0-9]+)*)\b/);
    if (m && /serif|sans|display|mono|type|font/i.test(line)) found.push(m[1]);
  }
  // Defaults — INSP-VALUE when empty so the menubar stays honest
  if (found.length === 0) return ["INSP-VALUE", "INSP-VALUE"];
  return found.slice(0, 4);
}

function defaultSpacing(): Record<string, string> {
  return {
    "--space-1": "0.25rem",
    "--space-2": "0.5rem",
    "--space-3": "1rem",
    "--space-4": "1.5rem",
    "--space-5": "2.5rem",
    "--radius": "0.5rem",
    "--measure": "65ch"
  };
}

function normalizeModelConfidences(models: StudioModel[]): void {
  const sum = models.reduce((s, m) => s + m.confidence, 0) || 1;
  for (const m of models) m.confidence = clamp01(m.confidence / sum);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function renderStudioHtml(data: StudioPayload): string {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RizzFizz Studio — ${esc(data.site_name)}</title>
<style>
:root {
  --bar-h: 28px; /* Mac menubar-ish */
  --font-1: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-2: ui-serif, Georgia, "Times New Roman", serif;
  --font-3: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --paper: #f4f1ea;
  --panel: #fffdf8;
  --ink: #17140f;
  --muted: #6b645a;
  --accent: #c45c26;
  --accent-strong: #9a3f12;
  --line: #d9d2c5;
  --bar-bg: rgba(22,20,18,.92);
  --bar-ink: #f4f1ea;
  --bar-muted: #b8b0a4;
${Object.entries(data.spacing).map(([k, v]) => `  ${k}: ${v};`).join("\n")}
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  font-family: var(--font-1);
  background:
    radial-gradient(1200px 600px at 10% -10%, color-mix(in oklab, var(--accent) 18%, transparent), transparent),
    linear-gradient(180deg, color-mix(in oklab, var(--paper) 88%, #fff), var(--paper));
  color: var(--ink);
  padding-top: ${data.bar === "bottom" ? "0" : "var(--bar-h)"};
  padding-bottom: ${data.bar === "top" ? "0" : "var(--bar-h)"};
}
/* ── Menubar ── */
.rf-bar {
  position: fixed; left: 0; right: 0; z-index: 1000;
  height: var(--bar-h);
  display: flex; align-items: center; gap: 6px;
  padding: 0 8px;
  background: var(--bar-bg);
  color: var(--bar-ink);
  backdrop-filter: blur(10px);
  font-size: 11px;
  letter-spacing: .01em;
  user-select: none;
}
.rf-bar.top { top: 0; border-bottom: 1px solid rgba(255,255,255,.08); }
.rf-bar.bottom { bottom: 0; border-top: 1px solid rgba(255,255,255,.08); }
.rf-bar .site {
  font-family: var(--font-1);
  font-weight: 650;
  font-size: 12px;
  max-width: 160px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rf-bar .ds {
  position: relative;
  height: calc(var(--bar-h) - 6px);
  min-width: 88px;
  padding: 0 8px;
  margin: 0 3px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; cursor: pointer;
  background: linear-gradient(90deg, var(--ds-y, #3d7a4a) var(--ds-pct, 50%), var(--ds-n, #7a3d3d) var(--ds-pct, 50%));
  color: #fff;
  mix-blend-mode: difference;
  font: 650 10px/1 var(--font-1);
  letter-spacing: .02em;
}
.rf-bar .ds span { mix-blend-mode: difference; }
.rf-bar .meta-chip {
  color: var(--bar-muted);
  font-size: 10px;
  white-space: nowrap;
}
.rf-bar .fonts { display: flex; align-items: baseline; gap: 4px; margin-left: 4px; }
.rf-bar .fonts select {
  appearance: none; border: 0; background: transparent; color: var(--bar-ink);
  font-size: 11px; padding: 0; cursor: pointer; max-width: 90px;
}
.rf-bar .fonts select:nth-child(2) { font-size: 10px; opacity: .85; }
.rf-bar .fonts select:nth-child(3) { font-size: 9px; opacity: .7; }
.rf-bar .pal {
  display: flex; align-items: center; gap: 2px;
  height: 16px; margin-left: 6px;
}
.rf-bar .sw {
  width: 14px; height: 14px; border-radius: 2px;
  border: 1px solid rgba(255,255,255,.25);
  cursor: pointer;
}
.rf-bar .vars { display: flex; gap: 2px; margin-left: 6px; }
.rf-bar .var-btn {
  height: 16px; padding: 0 5px; border-radius: 3px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.06); color: var(--bar-ink);
  font: 650 9px/16px var(--font-3); cursor: pointer;
}
.rf-bar .var-btn[aria-pressed="true"] { background: var(--accent); border-color: transparent; }
.rf-bar .icons { display: flex; gap: 2px; margin-left: 6px; }
.rf-bar .icon-btn {
  width: 22px; height: 22px; border: 0; border-radius: 4px;
  background: transparent; color: var(--bar-ink); cursor: pointer;
  display: grid; place-items: center; font-size: 13px;
}
.rf-bar .icon-btn:hover { background: rgba(255,255,255,.1); }
.rf-bar .spacer { flex: 1; }
.rf-bar .right { display: flex; align-items: center; gap: 4px; }
.tip {
  position: fixed; z-index: 1100; pointer-events: none;
  max-width: 280px; padding: 8px 10px; border-radius: 6px;
  background: #12100e; color: #f6f2ea; font: 11px/1.35 var(--font-3);
  box-shadow: 0 8px 24px rgba(0,0,0,.35); opacity: 0; transform: translateY(4px);
  transition: opacity .12s ease;
}
.tip.show { opacity: 1; transform: none; }
.tip b { color: #fff; }
.menu {
  position: fixed; z-index: 1100; min-width: 160px;
  background: #1a1714; color: #f4f1ea; border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px; padding: 4px; box-shadow: 0 12px 32px rgba(0,0,0,.4);
  display: none;
}
.menu.open { display: block; }
.menu button {
  display: block; width: 100%; text-align: left;
  border: 0; background: transparent; color: inherit;
  padding: 6px 8px; border-radius: 5px; font: 12px/1.3 var(--font-1); cursor: pointer;
}
.menu button:hover { background: rgba(255,255,255,.08); }
/* ── Page composition ── */
.page {
  width: min(1100px, calc(100% - 48px));
  margin: 0 auto;
  padding: var(--space-5) 0;
}
.hero {
  min-height: 52vh;
  display: grid;
  align-content: end;
  gap: var(--space-3);
  padding: var(--space-5) 0 var(--space-4);
  border-bottom: 1px solid var(--line);
}
.hero .eyebrow {
  font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
}
.hero h1 {
  margin: 0;
  font-family: var(--font-1);
  font-size: clamp(2.4rem, 7vw, 4.8rem);
  line-height: .95;
  letter-spacing: -.03em;
  max-width: 14ch;
}
.hero .sub {
  font-family: var(--font-2);
  font-size: 1.15rem;
  color: var(--muted);
  max-width: 40ch;
}
.cta-row { display: flex; gap: 10px; flex-wrap: wrap; }
.btn {
  border: 0; border-radius: 999px; padding: .7rem 1.1rem;
  font: 650 13px/1 var(--font-1); cursor: pointer;
}
.btn.primary { background: var(--accent); color: #fff; }
.btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
.section {
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--line);
}
.section h2 {
  margin: 0 0 var(--space-2);
  font-family: var(--font-1);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  letter-spacing: -.02em;
}
.section p, .section .body {
  margin: 0;
  font-family: var(--font-2);
  font-size: 1.05rem;
  max-width: var(--measure);
  color: color-mix(in oklab, var(--ink) 88%, var(--muted));
}
.token-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-top: var(--space-3);
}
.token-card {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--panel);
}
.token-card .chip { height: 48px; }
.token-card .lbl {
  padding: 8px 10px; font: 11px/1.3 var(--font-3);
}
.edit-wrap { position: relative; }
.edit-wrap .pen {
  position: absolute; top: -6px; right: -18px;
  width: 22px; height: 22px; border: 0; border-radius: 50%;
  background: var(--panel); border: 1px solid var(--line);
  cursor: pointer; font-size: 11px;
}
[contenteditable="true"]:focus { outline: 2px solid color-mix(in oklab, var(--accent) 50%, transparent); outline-offset: 3px; }
.pull-row { display: flex; gap: 8px; margin-top: var(--space-2); }
.footer {
  padding: var(--space-4) 0 var(--space-5);
  color: var(--muted); font-size: 13px;
}
.toast {
  position: fixed; right: 16px; bottom: calc(var(--bar-h) + 12px);
  background: #12100e; color: #fff; padding: 8px 12px; border-radius: 8px;
  font: 12px/1.3 var(--font-1); opacity: 0; transition: opacity .2s; z-index: 1200;
}
.toast.show { opacity: 1; }
</style>
</head>
<body>
<div id="tip" class="tip" role="tooltip"></div>
<div id="menu" class="menu" role="menu"></div>
<div id="toast" class="toast"></div>

${data.bar !== "bottom" ? barHtml("top") : ""}
${data.bar !== "top" ? barHtml("bottom") : ""}

<main class="page" id="page">
  <header class="hero">
    <div class="eyebrow edit-wrap">
      <span contenteditable="false" data-edit="eyebrow">Design preview</span>
      <button class="pen" type="button" data-pen="eyebrow" title="Edit">✎</button>
    </div>
    <h1 class="edit-wrap" id="site-title">
      <span contenteditable="false" data-edit="site">${esc(data.site_name)}</span>
      <button class="pen" type="button" data-pen="site" title="Edit site name">✎</button>
    </h1>
    <p class="sub edit-wrap">
      <span contenteditable="false" data-edit="sub">One composition. Brand first. Tokens live.</span>
      <button class="pen" type="button" data-pen="sub" title="Edit">✎</button>
    </p>
    <div class="cta-row">
      <button class="btn primary" type="button">Primary action</button>
      <button class="btn ghost" type="button">Secondary</button>
    </div>
    <div class="pull-row">
      <button class="btn ghost" type="button" id="btn-pull-copy" title="Pull copy from --copy URL">Pull copy</button>
      <button class="btn ghost" type="button" id="btn-pull-img" title="Pull images from --img URL">Pull images</button>
    </div>
  </header>

  <section class="section">
    <h2 class="edit-wrap">
      <span contenteditable="false" data-edit="h2">System in use</span>
      <button class="pen" type="button" data-pen="h2" title="Edit">✎</button>
    </h2>
    <p class="body edit-wrap">
      <span contenteditable="false" data-edit="body">Spacing, type roles, and colour relationships from the selected variant. Inspired-by is source-safe when present; otherwise INSP-VALUE.</span>
      <button class="pen" type="button" data-pen="body" title="Edit">✎</button>
    </p>
    <div class="token-grid" id="token-grid"></div>
  </section>

  <footer class="footer">
    <div><strong id="foot-ds">${esc(data.design_system)}</strong> · <span id="foot-insp">${esc(data.insp)}</span></div>
    <div id="foot-meta">${esc(data.page_name)} · scanned ${esc(data.scan_date.slice(0, 10))} · <span id="foot-nvars"></span> palettes</div>
  </footer>
</main>

<script type="application/json" id="rf-data">${payload}</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById("rf-data").textContent);
  const tip = document.getElementById("tip");
  const menu = document.getElementById("menu");
  const toast = document.getElementById("toast");
  const log = [];
  let activeVar = 0;
  let activeModel = 0;

  const FONT_CHOICES = [
    "INSP-VALUE",
    "Instrument Serif",
    "Fraunces",
    "Newsreader",
    "IBM Plex Sans",
    "DM Sans",
    "Space Grotesk",
    "JetBrains Mono"
  ];

  function applyTokens(tokens) {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(tokens)) {
      root.setProperty("--" + k.replaceAll("_", "-"), v);
    }
    // map doctrine → CSS used by page
    root.setProperty("--paper", tokens.paper);
    root.setProperty("--panel", tokens.panel);
    root.setProperty("--ink", tokens.ink);
    root.setProperty("--muted", tokens.muted);
    root.setProperty("--accent", tokens.accent);
    root.setProperty("--accent-strong", tokens.accent_strong);
    root.setProperty("--line", tokens.line);
  }

  function renderTokens(variant) {
    const grid = document.getElementById("token-grid");
    grid.innerHTML = variant.colors.map(c => \`
      <div class="token-card">
        <div class="chip" style="background:\${c.hex}"></div>
        <div class="lbl"><b>\${c.role}</b><br>\${c.hex}<br>\${c.name}</div>
      </div>\`).join("");
  }

  function syncBars() {
    document.querySelectorAll(".rf-bar").forEach(bar => {
      // palette swatches
      const pal = bar.querySelector("[data-pal]");
      const v = data.variants[activeVar];
      pal.innerHTML = v.colors.map((c, i) =>
        \`<button class="sw" type="button" data-sw="\${i}" style="background:\${c.hex}" aria-label="\${c.role}"></button>\`
      ).join("");
      // var buttons
      const vars = bar.querySelector("[data-vars]");
      vars.innerHTML = data.variants.map((vv, i) =>
        \`<button class="var-btn" type="button" data-var="\${i}" aria-pressed="\${i===activeVar}">\${vv.label}</button>\`
      ).join("");
      // design system chip
      const m = data.models[activeModel] || data.models[0];
      const pct = Math.round((m?.confidence || 0) * 100);
      const ds = bar.querySelector("[data-ds]");
      ds.style.setProperty("--ds-pct", pct + "%");
      ds.querySelector("span").textContent = (m?.name || "—") + " " + pct + "%";
      // fonts
      const fonts = bar.querySelector("[data-fonts]");
      fonts.innerHTML = "";
      const list = data.fonts.length ? data.fonts : ["INSP-VALUE"];
      list.slice(0, 3).forEach((fname, idx) => {
        const sel = document.createElement("select");
        sel.dataset.font = String(idx + 1);
        FONT_CHOICES.forEach(opt => {
          const o = document.createElement("option");
          o.value = opt; o.textContent = opt;
          if (opt === fname) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", () => {
          data.fonts[idx] = sel.value;
          document.documentElement.style.setProperty("--font-" + (idx + 1), fontStack(sel.value));
          pushLog({ kind: "font-change", font_slot: idx + 1, value: sel.value });
          toastMsg("Font " + (idx + 1) + " → " + sel.value);
        });
        fonts.appendChild(sel);
      });
      bar.querySelector("[data-site]").textContent = data.site_name;
      bar.querySelector("[data-n]").textContent = data.variants.length + " palettes";
    });
    document.getElementById("foot-nvars").textContent = String(data.variants.length);
    document.getElementById("site-title").querySelector("[data-edit]").textContent = data.site_name;
  }

  function fontStack(name) {
    if (!name || name === "INSP-VALUE") return 'ui-sans-serif, system-ui, sans-serif';
    if (/mono/i.test(name)) return '"' + name + '", ui-monospace, monospace';
    if (/serif|newsreader|fraunces|instrument/i.test(name)) return '"' + name + '", ui-serif, Georgia, serif';
    return '"' + name + '", ui-sans-serif, system-ui, sans-serif';
  }

  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.style.left = Math.min(window.innerWidth - 300, Math.max(8, x + 12)) + "px";
    tip.style.top = Math.min(window.innerHeight - 120, Math.max(8, y + 16)) + "px";
    tip.classList.add("show");
  }
  function hideTip() { tip.classList.remove("show"); }

  function colorTip(c) {
    return \`<b>\${c.role}</b> · \${c.name}<br>
HEX \${c.hex}<br>
OKLCH \${c.oklch.l} \${c.oklch.c} \${c.oklch.h}<br>
L* \${c.luminance} · vs paper \${c.contrast_on_paper}:1 · vs ink \${c.contrast_on_ink}:1\`;
  }
  function variantTip(v) {
    const roles = v.colors.map(c => c.hex).join(" · ");
    return \`<b>\${v.label}</b> \${v.name}<br>\${v.colors.length} colours<br>\${roles}\`;
  }

  function openMenu(x, y, items) {
    menu.innerHTML = items.map((it, i) =>
      \`<button type="button" data-i="\${i}" role="menuitem">\${it.label}</button>\`
    ).join("");
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.classList.add("open");
    menu.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        items[Number(btn.dataset.i)].onClick();
        menu.classList.remove("open");
      });
    });
  }

  function toastMsg(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1600);
  }

  function pushLog(entry) {
    log.push({ ...entry, at: new Date().toISOString(), site: data.site_name, insp: data.insp });
  }

  function downloadLog() {
    const blob = new Blob([log.map(x => JSON.stringify(x)).join("\\n") + "\\n"], { type: "application/x-ndjson" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rizzfizz-studio-interactions-" + Date.now() + ".jsonl";
    a.click();
    toastMsg("Saved interaction log (" + log.length + ")");
  }

  function selectVariant(i) {
    activeVar = i;
    const v = data.variants[i];
    applyTokens(v.tokens);
    renderTokens(v);
    syncBars();
    pushLog({ kind: "variant-select", variant: v.label, id: v.id });
  }

  function selectModel(i) {
    const prev = data.models[activeModel];
    activeModel = i;
    // Human/AI override: selected becomes 100%, others retained for hover detail
    data.models = data.models.map((m, idx) => ({
      ...m,
      confidence: idx === i ? 1 : m.confidence,
      _previous: idx === i ? undefined : m.confidence
    }));
    syncBars();
    pushLog({
      kind: "design-system-override",
      from: prev?.id,
      to: data.models[i].id,
      note: "second_human_or_ai_validation",
      needs_review: true
    });
    toastMsg("Design system → " + data.models[i].name + " (logged)");
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (!menu.contains(t)) menu.classList.remove("open");

    const sw = t.closest("[data-sw]");
    if (sw) {
      const c = data.variants[activeVar].colors[Number(sw.getAttribute("data-sw"))];
      showTip(colorTip(c), e.clientX, e.clientY);
      return;
    }
    const vb = t.closest("[data-var]");
    if (vb) {
      selectVariant(Number(vb.getAttribute("data-var")));
      return;
    }
    const ds = t.closest("[data-ds]");
    if (ds) {
      openMenu(e.clientX, e.clientY, data.models.map((m, i) => ({
        label: m.name + " · " + Math.round(m.confidence * 100) + "%",
        onClick: () => selectModel(i)
      })));
      return;
    }
    const act = t.closest("[data-act]");
    if (act) {
      const a = act.getAttribute("data-act");
      if (a === "fav") openMenu(e.clientX, e.clientY, (data.favourites.length ? data.favourites : ["(empty)"]).map(label => ({
        label, onClick: () => { pushLog({ kind: "save-favourite", list: label, variant: data.variants[activeVar].label }); toastMsg("Saved to " + label); }
      })));
      if (a === "client") openMenu(e.clientX, e.clientY, (data.clients.length ? data.clients : ["(no clients)"]).map(label => ({
        label, onClick: () => { pushLog({ kind: "save-client", client: label, variant: data.variants[activeVar].label }); toastMsg("Saved to client " + label); }
      })));
      if (a === "reriff") {
        pushLog({ kind: "reriff-request", variant: data.variants[activeVar].label, colors: data.variants[activeVar].colors.map(c => c.hex) });
        toastMsg("Reriff requested — use CLI: rizzfizz reriff --lock …");
      }
      if (a === "notes") {
        downloadLog();
      }
      if (a === "collections") openMenu(e.clientX, e.clientY, (data.collections.length ? data.collections : ["(empty)"]).map(label => ({
        label, onClick: () => { pushLog({ kind: "save-collection", collection: label }); toastMsg("→ " + label); }
      })));
    }
    const pen = t.closest("[data-pen]");
    if (pen) {
      const key = pen.getAttribute("data-pen");
      const span = document.querySelector('[data-edit="' + key + '"]');
      if (span) {
        const on = span.getAttribute("contenteditable") === "true";
        span.setAttribute("contenteditable", on ? "false" : "true");
        if (!on) span.focus();
        else {
          if (key === "site") {
            data.site_name = span.textContent.trim() || "INSP-VALUE";
            syncBars();
          }
          pushLog({ kind: "edit-text", field: key, value: span.textContent.trim() });
        }
      }
    }
  });

  document.addEventListener("mousemove", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const sw = t.closest("[data-sw]");
    if (sw) {
      const c = data.variants[activeVar].colors[Number(sw.getAttribute("data-sw"))];
      showTip(colorTip(c), e.clientX, e.clientY);
      return;
    }
    const vb = t.closest("[data-var]");
    if (vb) {
      showTip(variantTip(data.variants[Number(vb.getAttribute("data-var"))]), e.clientX, e.clientY);
      return;
    }
    const ds = t.closest("[data-ds]");
    if (ds) {
      const lines = data.models.map(m => m.name + ": " + Math.round(m.confidence * 100) + "%").join("<br>");
      showTip("<b>Design system</b><br>" + lines + "<br><i>click to override · logged for accuracy review</i>", e.clientX, e.clientY);
      return;
    }
    if (!t.closest(".rf-bar")) hideTip();
  });

  document.getElementById("btn-pull-copy")?.addEventListener("click", () => {
    pushLog({ kind: "pull-copy-request", insp: data.insp });
    toastMsg("Pull copy → run: rizzfizz pull --copy <url>");
  });
  document.getElementById("btn-pull-img")?.addEventListener("click", () => {
    pushLog({ kind: "pull-img-request", insp: data.insp });
    toastMsg("Pull images → run: rizzfizz pull --img <url> --count 3");
  });

  // init
  if (data.variants[0]) selectVariant(0);
  data.fonts.forEach((f, i) => {
    document.documentElement.style.setProperty("--font-" + (i + 1), fontStack(f));
  });
})();
</script>
</body>
</html>`;
}

function barHtml(pos: "top" | "bottom"): string {
  return `<div class="rf-bar ${pos}" data-bar="${pos}">
  <span class="site" data-site></span>
  <button class="ds" type="button" data-ds title="Design system confidence"><span></span></button>
  <span class="meta-chip" data-n></span>
  <span class="fonts" data-fonts></span>
  <span class="pal" data-pal aria-label="palette"></span>
  <span class="icons">
    <button class="icon-btn" type="button" data-act="fav" title="Save to favourites">★</button>
    <button class="icon-btn" type="button" data-act="client" title="Save to clients">☺</button>
    <button class="icon-btn" type="button" data-act="collections" title="Collections">☰</button>
    <button class="icon-btn" type="button" data-act="reriff" title="Reriff">↻</button>
  </span>
  <span class="vars" data-vars></span>
  <span class="spacer"></span>
  <span class="right">
    <button class="icon-btn" type="button" data-act="notes" title="Notepad / export interaction log">▤</button>
  </span>
</div>`;
}

function esc(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
