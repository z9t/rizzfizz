import { access, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { nearestNamedColors, resolveColorName } from "./color-names.js";
import { contrastRatio, parseHexToOklch } from "./color.js";
import { rankDesignSystems } from "./design-system-taxonomy.js";
import { readJson, writeJson, writeText } from "./io.js";
import {
  defaultPageCopy,
  mergePageCopy,
  promptCopyPayload,
  type PageCopy
} from "./page-copy.js";
import type { RiffRun } from "./riff.js";
import type { BuildContract, PaletteRun, PaletteTokens, RunManifest } from "./types.js";

export type StudioPreviewOptions = {
  input: string;
  out: string;
  siteName?: string;
  pageName?: string;
  insp?: string;
  bar?: "top" | "bottom" | "both";
  body?: string;
  footer?: string;
  copy?: PageCopy;
  images?: string[];
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
  label: string;
  name: string;
  colors: StudioColor[];
  tokens: PaletteTokens;
};

type StudioModel = {
  id: string;
  name: string;
  confidence: number;
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
  copy: PageCopy;
  images: string[];
};

export async function writeStudioPreview(options: StudioPreviewOptions): Promise<string> {
  const input = resolve(options.input);
  const outPath = resolve(options.out);
  const payload = await loadStudioPayload(input, options);
  await writeText(outPath, renderStudioHtml(payload));
  const outDir = dirname(outPath);
  await writeJson(join(outDir, "prompt-copy.json"), promptCopyPayload(payload.copy));
  await writeText(join(outDir, "design-system-feedback.jsonl"), "");
  return outPath;
}

async function loadStudioPayload(input: string, options: StudioPreviewOptions): Promise<StudioPayload> {
  const bar = options.bar || "both";
  const scanDate = new Date().toISOString();
  const runDir = (await isFile(input)) ? dirname(input) : input;
  const { copy, images } = await resolveCopyAndImages(runDir, options);

  let payload: StudioPayload;
  if (await isFile(input) && input.endsWith(".json")) {
    const json = await readJson<Record<string, unknown>>(input);
    if (json.schema === "rizzfizz.riff-run.v1") {
      payload = fromRiff(json as unknown as RiffRun, options, scanDate, bar);
    } else if (json.schema === "rizzfizz.palette-run.v1" || Array.isArray(json.variants)) {
      payload = fromPaletteRun(json as unknown as PaletteRun, options, scanDate, bar);
    } else {
      throw new Error(`studio preview: unsupported JSON schema in ${input}`);
    }
  } else {
    const manifestPath = join(input, "run-manifest.json");
    if (await exists(manifestPath)) {
      const manifest = await readJson<RunManifest>(manifestPath);
      const contract = await readJson<BuildContract>(manifest.source_safe_entrypoints.build_contract);
      const paletteRun = await readJson<PaletteRun>(manifest.source_safe_entrypoints.palette_run);
      payload = fromRun(input, contract, paletteRun, options, scanDate, bar);
    } else {
      const palettePath = join(input, "palette-run.json");
      if (await exists(palettePath)) {
        payload = fromPaletteRun(await readJson<PaletteRun>(palettePath), options, scanDate, bar);
      } else {
        throw new Error(`studio preview: unsupported input ${input}`);
      }
    }
  }

  payload.copy = copy;
  payload.images = await toStudioImageRefs(images, options.out);
  if (!options.siteName && copy.site_name) payload.site_name = copy.site_name;
  if (!options.insp && copy.source_url) payload.insp = copy.source_url;
  return payload;
}

async function resolveCopyAndImages(
  runDir: string,
  options: StudioPreviewOptions
): Promise<{ copy: PageCopy; images: string[] }> {
  let copy = options.copy ? { ...options.copy } : defaultPageCopy();
  for (const path of [join(runDir, "pull", "pulled-copy.json"), join(runDir, "pulled-copy.json")]) {
    if (!(await exists(path))) continue;
    try {
      const loaded = await readJson<PageCopy>(path);
      if (loaded?.schema === "rizzfizz.page-copy.v1" || loaded?.body || loaded?.paragraphs) {
        copy = mergePageCopy(defaultPageCopy(loaded), loaded);
        break;
      }
    } catch {
      /* ignore */
    }
  }
  if (options.body || options.footer) {
    copy = mergePageCopy(copy, { body: options.body, footer: options.footer, prompt_example: true });
  }
  let images = options.images ? [...options.images] : [];
  if (images.length === 0) {
    const manifestPath = join(runDir, "pull", "pull-manifest.json");
    if (await exists(manifestPath)) {
      try {
        const manifest = await readJson<{ images?: { paths?: string[] } }>(manifestPath);
        images = (manifest.images?.paths || []).filter(Boolean);
      } catch {
        /* ignore */
      }
    }
  }
  return { copy, images };
}

async function toStudioImageRefs(paths: string[], outHtml: string): Promise<string[]> {
  const outDir = dirname(resolve(outHtml));
  const refs: string[] = [];
  for (const p of paths.slice(0, 6)) {
    const abs = resolve(p);
    if (!(await exists(abs))) continue;
    const rel = relative(outDir, abs).split("\\").join("/");
    if (rel && !rel.startsWith("..")) refs.push(rel);
  }
  return refs;
}

function umbrellaModels(textHint: string, relationship?: string, paletteRun?: PaletteRun): StudioModel[] {
  return rankDesignSystems({ text: textHint, relationship, paletteRun }).map((m) => ({
    id: m.id,
    name: m.name,
    confidence: m.confidence
  }));
}

function fromRun(
  inputDir: string,
  contract: BuildContract,
  paletteRun: PaletteRun,
  options: StudioPreviewOptions,
  scanDate: string,
  bar: StudioPreviewOptions["bar"]
): StudioPayload {
  const textHint = [
    contract.intent?.site_type,
    contract.intent?.content_posture,
    contract.design_system_classification?.primary?.name,
    paletteRun.relationship
  ].filter(Boolean).join(" ");
  const models = umbrellaModels(textHint, paletteRun.relationship, paletteRun);
  return {
    schema: "rizzfizz.studio-preview.v1",
    generated_at: scanDate,
    site_name: options.siteName || contract.intent.site_type || "INSP-VALUE",
    page_name: options.pageName || basename(inputDir),
    insp: options.insp || "INSP-VALUE",
    scan_date: scanDate,
    design_system: models[0]?.name || "Neo-Minimalism",
    models,
    fonts: extractFonts(contract),
    spacing: defaultSpacing(),
    variants: paletteRun.variants.map((v, i) => toStudioVariant(v.id, `VAR-${i + 1}`, v.name, v.tokens)),
    bar: bar || "both",
    copy: defaultPageCopy(),
    images: [],
    ...defaultLists()
  };
}

function fromPaletteRun(
  run: PaletteRun,
  options: StudioPreviewOptions,
  scanDate: string,
  bar: StudioPreviewOptions["bar"]
): StudioPayload {
  const models = umbrellaModels(run.relationship || "", run.relationship, run);
  return {
    schema: "rizzfizz.studio-preview.v1",
    generated_at: scanDate,
    site_name: options.siteName || "INSP-VALUE",
    page_name: options.pageName || "palette",
    insp: options.insp || "INSP-VALUE",
    scan_date: scanDate,
    design_system: models[0]?.name || "Neo-Minimalism",
    models,
    fonts: ["INSP-VALUE", "INSP-VALUE"],
    spacing: defaultSpacing(),
    variants: (run.variants || []).map((v, i) => toStudioVariant(v.id, `VAR-${i + 1}`, v.name, v.tokens)),
    bar: bar || "both",
    copy: defaultPageCopy(),
    images: [],
    ...defaultLists()
  };
}

function fromRiff(
  run: RiffRun,
  options: StudioPreviewOptions,
  scanDate: string,
  bar: StudioPreviewOptions["bar"]
): StudioPayload {
  const hint = (run.spec?.locked || []).map((l) => l.name).join(" ") + " riff";
  const models = umbrellaModels(hint, "riff");
  return {
    schema: "rizzfizz.studio-preview.v1",
    generated_at: scanDate,
    site_name: options.siteName || "INSP-VALUE",
    page_name: options.pageName || "riff",
    insp: options.insp || "INSP-VALUE",
    scan_date: scanDate,
    design_system: models[0]?.name || "Neo-Minimalism",
    models,
    fonts: ["INSP-VALUE", "INSP-VALUE"],
    spacing: defaultSpacing(),
    variants: (run.palettes || []).map((p, i) => toStudioVariant(p.id, `VAR-${i + 1}`, p.id, p.tokens)),
    bar: bar || "both",
    copy: defaultPageCopy(),
    images: [],
    ...defaultLists()
  };
}

function defaultLists(): Pick<StudioPayload, "clients" | "collections" | "favourites"> {
  return {
    clients: ["Acme Editorial", "North Pier", "Quiet Studio"],
    collections: ["Photography", "Product UI", "Dark sparse"],
    favourites: ["Saved blues", "Gallery neutrals"]
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
    luminance: Number(o.l.toFixed(4)),
    contrast_on_paper: contrastRatio(hex, paper),
    contrast_on_ink: contrastRatio(hex, ink)
  };
}

function extractFonts(contract: BuildContract): string[] {
  const evidence = contract.design_system_classification?.source_safe_evidence || [];
  const found: string[] = [];
  for (const line of evidence) {
    const m = line.match(/\b([A-Z][A-Za-z0-9]+(?:\s[A-Z][A-Za-z0-9]+)*)\b/);
    if (m && /serif|sans|display|mono|type|font/i.test(line)) found.push(m[1]);
  }
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

function esc(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function barHtml(pos: "top" | "bottom"): string {
  return `<div class="rf-bar ${pos}" data-bar="${pos}">
  <span class="site" data-site contenteditable="false" spellcheck="false" title="Site name"></span>
  <button class="ds" type="button" data-ds title="Design system confidence (5 umbrellas)"><span></span></button>
  <span class="meta-chip" data-n></span>
  <span class="fonts" data-fonts></span>
  <span class="pal" data-pal aria-label="palette"></span>
  <span class="icons">
    <button class="icon-btn" type="button" data-act="fav" title="Save to favourites">★</button>
    <button class="icon-btn" type="button" data-act="client" title="Save to clients">☺</button>
    <button class="icon-btn" type="button" data-act="collections" title="Save to collections">☰</button>
    <button class="icon-btn" type="button" data-act="reriff" title="Reriff">↻</button>
  </span>
  <span class="vars" data-vars></span>
  <span class="spacer"></span>
  <span class="right">
    <button class="icon-btn edit-toggle" type="button" data-act="edit" title="Edit mode (CMS)">✎</button>
  </span>
</div>`;
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
  --bar-h: 28px;
  --font-1: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-2: ui-serif, Georgia, "Times New Roman", serif;
  --font-3: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --paper: #f4f1ea; --panel: #fffdf8; --ink: #17140f; --muted: #6b645a;
  --accent: #c45c26; --accent-strong: #9a3f12; --line: #d9d2c5;
  --bar-bg: rgba(22,20,18,.92); --bar-ink: #f4f1ea; --bar-muted: #b8b0a4;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 1rem; --space-4: 1.5rem; --space-5: 2.5rem;
  --radius: 0.5rem; --measure: 65ch; --cms-w: 300px;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  font-family: var(--font-1);
  background:
    radial-gradient(1200px 600px at 10% -10%, color-mix(in oklab, var(--accent) 18%, transparent), transparent),
    linear-gradient(180deg, color-mix(in oklab, var(--paper) 88%, #fff), var(--paper));
  color: var(--ink);
  padding-top: var(--bar-h);
  padding-bottom: var(--bar-h);
  transition: padding-right .2s ease;
}
body.edit-mode { padding-right: var(--cms-w); }
body.edit-mode [data-edit] {
  outline: 1px dashed color-mix(in oklab, var(--accent) 45%, transparent);
  outline-offset: 2px;
  cursor: text;
  min-width: 1ch;
}
.rf-bar {
  position: fixed; left: 0; right: 0; z-index: 1000;
  height: var(--bar-h); display: flex; align-items: center; gap: 6px;
  padding: 0 8px; background: var(--bar-bg); color: var(--bar-ink);
  backdrop-filter: blur(10px); font-size: 11px; user-select: none;
}
.rf-bar.top { top: 0; border-bottom: 1px solid rgba(255,255,255,.08); }
.rf-bar.bottom { bottom: 0; border-top: 1px solid rgba(255,255,255,.08); }
body.edit-mode .rf-bar { right: var(--cms-w); }
.rf-bar .site {
  font-family: var(--font-1); font-weight: 650; font-size: 12px;
  max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rf-bar .ds {
  position: relative; height: calc(var(--bar-h) - 6px); min-width: 96px;
  padding: 0 8px; margin: 0 3px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; cursor: pointer;
  background: linear-gradient(90deg, var(--ds-y, #3d7a4a) var(--ds-pct, 50%), var(--ds-n, #7a3d3d) var(--ds-pct, 50%));
  color: #fff; mix-blend-mode: difference;
  font: 650 10px/1 var(--font-1); letter-spacing: .02em;
}
.rf-bar .ds span { mix-blend-mode: difference; }
.rf-bar .meta-chip { color: var(--bar-muted); white-space: nowrap; }
.rf-bar .fonts { display: inline-flex; align-items: baseline; gap: 4px; max-width: 220px; overflow: hidden; }
.rf-bar .fonts select {
  appearance: none; background: transparent; border: 0; color: var(--bar-ink);
  font: inherit; max-width: 72px; cursor: pointer; padding: 0;
}
.rf-bar .fonts select:nth-child(1) { font-size: 11px; }
.rf-bar .fonts select:nth-child(2) { font-size: 10px; opacity: .9; }
.rf-bar .fonts select:nth-child(3) { font-size: 9px; opacity: .8; }
.rf-bar .pal, .rf-bar .vars { display: inline-flex; gap: 3px; align-items: center; }
.rf-bar .sw {
  width: 14px; height: 14px; border-radius: 2px; border: 1px solid rgba(255,255,255,.25);
  padding: 0; cursor: pointer;
}
.rf-bar .var-btn {
  height: 18px; padding: 0 5px; border: 1px solid rgba(255,255,255,.18);
  background: transparent; color: var(--bar-ink); font: 650 9px/1 var(--font-1);
  border-radius: 3px; cursor: pointer;
}
.rf-bar .var-btn[aria-pressed="true"] { background: rgba(255,255,255,.14); }
.rf-bar .icons { display: inline-flex; gap: 2px; margin-left: 4px; }
.rf-bar .icon-btn {
  width: 22px; height: 22px; border: 0; border-radius: 4px;
  background: transparent; color: var(--bar-ink); cursor: pointer; font-size: 13px;
}
.rf-bar .icon-btn:hover, .rf-bar .icon-btn[aria-pressed="true"] { background: rgba(255,255,255,.12); }
.rf-bar .spacer { flex: 1; }
.rf-bar .right { display: inline-flex; gap: 2px; }
.page { max-width: 920px; margin: 0 auto; padding: var(--space-5) var(--space-4); }
.hero { min-height: 52vh; display: grid; align-content: end; gap: var(--space-3); padding-bottom: var(--space-5); }
.hero .eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.hero h1 { font-family: var(--font-1); font-size: clamp(2.4rem, 6vw, 4.2rem); line-height: 1.05; margin: 0; font-weight: 650; }
.hero .sub { font-size: 1.1rem; max-width: 42ch; color: var(--muted); margin: 0; }
.cta-row { display: flex; gap: 10px; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; padding: 10px 16px; border-radius: 2px;
  border: 1px solid var(--line); font: 650 14px/1 var(--font-1); cursor: default;
}
.btn.primary { background: var(--accent); color: #fff; border-color: var(--accent-strong); }
.btn.ghost { background: transparent; }
.hero-imgs { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; width: min(100%, 720px); }
.hero-imgs img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border: 1px solid var(--line); }
.section { padding: var(--space-5) 0; border-top: 1px solid var(--line); }
.section h2 { font-family: var(--font-2); font-size: 1.75rem; margin: 0 0 var(--space-3); }
.section .body { max-width: var(--measure); line-height: 1.55; white-space: pre-wrap; }
.token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: var(--space-4); }
.token-card { border: 1px solid var(--line); padding: 8px; background: var(--panel); }
.token-card .chip { height: 36px; border-radius: 2px; margin-bottom: 6px; }
.token-card .lbl { font-size: 11px; color: var(--muted); }
.footer { padding: var(--space-4) 0 var(--space-5); border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
.footer [data-edit="footer"] { display: block; max-width: 52ch; white-space: pre-wrap; color: var(--ink); margin-bottom: 8px; }
/* CMS panel — only visible in edit mode; no tab chrome */
.cms {
  position: fixed; top: 0; right: 0; bottom: 0; width: var(--cms-w); z-index: 1100;
  background: #161412; color: #f4f1ea; transform: translateX(100%);
  transition: transform .2s ease; overflow: auto; padding: 36px 12px 16px;
  border-left: 1px solid rgba(255,255,255,.08); font-size: 12px;
}
body.edit-mode .cms { transform: translateX(0); }
.cms h3 { margin: 16px 0 8px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #b8b0a4; }
.cms h3:first-child { margin-top: 0; }
.cms .row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.cms button, .cms label.file {
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14);
  color: inherit; padding: 6px 8px; border-radius: 4px; cursor: pointer; font: inherit;
}
.cms button:hover { background: rgba(255,255,255,.14); }
.cms ul { list-style: none; margin: 0; padding: 0; }
.cms li { display: flex; gap: 6px; align-items: center; padding: 4px 0; }
.cms li input { margin: 0; }
.cms select, .cms input[type="text"] {
  width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
  color: inherit; padding: 6px 8px; border-radius: 4px; font: inherit; margin-bottom: 6px;
}
.cms .done {
  position: sticky; top: -28px; margin: -28px -12px 12px; padding: 8px 12px;
  background: #1e1b18; border-bottom: 1px solid rgba(255,255,255,.08);
  display: flex; justify-content: space-between; align-items: center;
}
.tip {
  position: fixed; pointer-events: none; z-index: 1200; max-width: 280px;
  background: #12100e; color: #fff; padding: 8px 10px; border-radius: 6px;
  font: 11px/1.35 var(--font-1); opacity: 0; transition: opacity .15s;
}
.tip.show { opacity: 1; }
.menu {
  position: fixed; z-index: 1200; min-width: 180px; background: #1a1714; color: #f4f1ea;
  border: 1px solid rgba(255,255,255,.12); border-radius: 6px; padding: 4px; display: none;
}
.menu.open { display: block; }
.menu button {
  display: block; width: 100%; text-align: left; background: transparent; border: 0;
  color: inherit; padding: 6px 8px; font: 12px/1.3 var(--font-1); cursor: pointer; border-radius: 4px;
}
.menu button:hover { background: rgba(255,255,255,.08); }
.menu .menu-hint { padding: 4px 8px; font-size: 10px; color: #b8b0a4; }
.toast {
  position: fixed; bottom: calc(var(--bar-h) + 12px); left: 50%; transform: translateX(-50%);
  background: #12100e; color: #fff; padding: 8px 12px; border-radius: 8px;
  font: 12px/1.3 var(--font-1); opacity: 0; transition: opacity .2s; z-index: 1300;
}
.toast.show { opacity: 1; }
</style>
</head>
<body>
<div id="tip" class="tip" role="tooltip"></div>
<div id="menu" class="menu" role="menu"></div>
<div id="toast" class="toast"></div>

<aside class="cms" id="cms" aria-label="Edit mode" hidden>
  <div class="done">
    <strong>Edit mode</strong>
    <button type="button" id="cms-done">Done</button>
  </div>
  <h3>Presets</h3>
  <select id="cms-bucket">
    <option value="favourites">Favourites</option>
    <option value="clients">Clients</option>
    <option value="collections">Collections</option>
  </select>
  <ul id="cms-preset-list"></ul>
  <div class="row">
    <button type="button" id="cms-preset-add">Add</button>
    <button type="button" id="cms-preset-del">Delete selected</button>
    <button type="button" id="cms-preset-backup">Backup JSON</button>
    <label class="file">Restore<input type="file" id="cms-preset-restore" accept="application/json,.json" hidden></label>
  </div>
  <h3>Fonts</h3>
  <select id="cms-font-slot">
    <option value="1">Font 1</option>
    <option value="2">Font 2</option>
    <option value="3">Font 3</option>
  </select>
  <select id="cms-font-pick"></select>
  <div class="row">
    <button type="button" id="cms-font-apply">Apply font</button>
    <button type="button" id="cms-font-get">Get font (Google)</button>
  </div>
  <h3>Load palette</h3>
  <textarea id="cms-palette-paste" rows="4" placeholder='Paste palette-run JSON or {"tokens":{...}}' style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:4px;font:11px/1.3 ui-monospace,monospace;padding:6px"></textarea>
  <div class="row"><button type="button" id="cms-palette-load">Load into active VAR</button></div>
  <h3>Save / log</h3>
  <div class="row">
    <button type="button" id="cms-save-state">Save studio JSON</button>
    <button type="button" id="cms-prompt-copy">Body/footer → prompts</button>
    <button type="button" id="cms-export-log">Accuracy / interaction log</button>
  </div>
</aside>

${data.bar !== "bottom" ? barHtml("top") : ""}
${data.bar !== "top" ? barHtml("bottom") : ""}

<main class="page" id="page">
  <header class="hero">
    <div class="eyebrow"><span data-edit="eyebrow">${esc(data.copy.eyebrow || "Design preview")}</span></div>
    <h1 id="site-title"><span data-edit="site">${esc(data.site_name)}</span></h1>
    <p class="sub"><span data-edit="sub">${esc(data.copy.sub || "")}</span></p>
    <div class="cta-row">
      <span class="btn primary" data-edit="cta-primary" role="button">${esc(data.copy.cta_primary || "Primary action")}</span>
      <span class="btn ghost" data-edit="cta-secondary" role="button">${esc(data.copy.cta_secondary || "Secondary")}</span>
    </div>
    ${data.images.length ? `<div class="hero-imgs">${data.images.map((src) => `<img src="${esc(src)}" alt="" loading="lazy">`).join("")}</div>` : ""}
  </header>
  <section class="section">
    <h2><span data-edit="h2">${esc(data.copy.h2 || "System in use")}</span></h2>
    <p class="body"><span data-edit="body">${esc(data.copy.body || "")}</span></p>
    <div class="token-grid" id="token-grid"></div>
  </section>
  <footer class="footer">
    <span data-edit="footer">${esc(data.copy.footer || "")}</span>
    <div><strong id="foot-ds">${esc(data.design_system)}</strong> · <span data-edit="insp">${esc(data.insp)}</span></div>
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
  const cms = document.getElementById("cms");
  const STORE_LISTS = "rizzfizz.studio.lists.v1";
  const STORE_SAVES = "rizzfizz.studio.saves.v1";
  const STORE_COPY = "rizzfizz.studio.copy.v1:" + (data.site_name || "") + ":" + (data.insp || "");
  const log = [];
  let activeVar = 0;
  let activeModel = 0;
  let editMode = false;
  if (!data.copy) data.copy = {};

  const FONT_CHOICES = [
    "INSP-VALUE", "Instrument Serif", "Fraunces", "Newsreader", "Playfair Display",
    "IBM Plex Sans", "DM Sans", "Space Grotesk", "Inter", "Source Serif 4",
    "Libre Baskerville", "JetBrains Mono", "IBM Plex Mono", "Syne", "Outfit"
  ];

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  const lists = loadJson(STORE_LISTS, null);
  if (lists) {
    data.favourites = lists.favourites || data.favourites;
    data.clients = lists.clients || data.clients;
    data.collections = lists.collections || data.collections;
  }
  const savedItems = loadJson(STORE_SAVES, { favourites: {}, clients: {}, collections: {} });
  applyStoredCopy(loadJson(STORE_COPY, {}));

  function persistLists() {
    saveJson(STORE_LISTS, { favourites: data.favourites, clients: data.clients, collections: data.collections });
  }
  function textOf(key) {
    const el = document.querySelector('[data-edit="' + key + '"]');
    return el ? el.textContent.trim() : "";
  }
  function persistCopy() {
    const next = {
      site: data.site_name, insp: data.insp,
      eyebrow: textOf("eyebrow"), sub: textOf("sub"), h2: textOf("h2"),
      body: textOf("body"), footer: textOf("footer"),
      cta_primary: textOf("cta-primary"), cta_secondary: textOf("cta-secondary"),
      prompt_example: true
    };
    data.copy = { ...data.copy, ...next };
    saveJson(STORE_COPY, next);
  }
  function applyStoredCopy(stored) {
    if (!stored || typeof stored !== "object") return;
    queueMicrotask(() => {
      for (const [key, val] of Object.entries({
        eyebrow: stored.eyebrow, site: stored.site, sub: stored.sub, h2: stored.h2,
        body: stored.body, footer: stored.footer,
        "cta-primary": stored.cta_primary, "cta-secondary": stored.cta_secondary, insp: stored.insp
      })) {
        if (!val) continue;
        const el = document.querySelector('[data-edit="' + key + '"]');
        if (el) el.textContent = val;
      }
      if (stored.site) data.site_name = stored.site;
      if (stored.insp) data.insp = stored.insp;
      syncSiteLabels();
    });
  }

  function toastMsg(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  function pushLog(entry) {
    log.push({ ...entry, at: new Date().toISOString(), site: data.site_name, insp: data.insp });
  }
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function contextLine() {
    return '<span style="opacity:.75">' + data.site_name + '</span> · ' + data.page_name + ' · ' + String(data.scan_date || "").slice(0, 10);
  }
  function colorTip(c) {
    return contextLine() + '<br><b>' + c.role + '</b> · ' + c.name + '<br>HEX ' + c.hex +
      '<br>OKLCH ' + c.oklch.l + ' ' + c.oklch.c + ' ' + c.oklch.h +
      '<br>L* ' + c.luminance + ' · vs paper ' + c.contrast_on_paper + ':1 · vs ink ' + c.contrast_on_ink + ':1';
  }
  function variantTip(v) {
    return contextLine() + '<br><b>' + v.label + '</b> ' + v.name + '<br>' +
      v.colors.map(c => c.role + ' ' + c.hex).join('<br>');
  }
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.style.left = Math.min(x + 12, window.innerWidth - 300) + 'px';
    tip.style.top = Math.min(y + 12, window.innerHeight - 120) + 'px';
    tip.classList.add('show');
  }
  function hideTip() { tip.classList.remove('show'); }

  function openMenu(x, y, items, hint) {
    menu.innerHTML = (hint ? '<div class="menu-hint">' + hint + '</div>' : '') +
      items.map((it, i) => '<button type="button" data-mi="' + i + '">' + it.label + '</button>').join('');
    menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 40) + 'px';
    menu.classList.add('open');
    menu.querySelectorAll('[data-mi]').forEach(btn => {
      btn.addEventListener('click', () => {
        items[Number(btn.getAttribute('data-mi'))].onClick();
        menu.classList.remove('open');
      });
    });
  }

  function applyTokens(tokens) {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(tokens)) root.setProperty('--' + k.replaceAll('_', '-'), v);
  }
  function renderTokens(variant) {
    document.getElementById('token-grid').innerHTML = variant.colors.map(c =>
      '<div class="token-card"><div class="chip" style="background:' + c.hex + '"></div><div class="lbl"><b>' +
      c.role + '</b><br>' + c.hex + '<br>' + c.name + '</div></div>').join('');
  }
  function fontStack(name) {
    if (!name || name === 'INSP-VALUE') return 'ui-sans-serif, system-ui, sans-serif';
    if (/mono/i.test(name)) return '"' + name + '", ui-monospace, monospace';
    if (/serif|newsreader|fraunces|instrument|playfair|baskerville|source serif/i.test(name))
      return '"' + name + '", ui-serif, Georgia, serif';
    return '"' + name + '", ui-sans-serif, system-ui, sans-serif';
  }
  function syncSiteLabels() {
    document.querySelectorAll('[data-site]').forEach(el => {
      if (document.activeElement === el) return;
      el.textContent = data.site_name;
    });
    const hero = document.querySelector('#site-title [data-edit="site"]');
    if (hero && !editMode) hero.textContent = data.site_name;
    const insp = document.querySelector('[data-edit="insp"]');
    if (insp && !editMode) insp.textContent = data.insp;
    const footDs = document.getElementById('foot-ds');
    if (footDs) footDs.textContent = data.models[activeModel]?.name || data.design_system;
    document.title = 'RizzFizz Studio — ' + data.site_name;
  }

  function syncBars() {
    const m = data.models[activeModel] || data.models[0];
    const m2 = data.models.filter((_, i) => i !== activeModel)[0] || data.models[1] || m;
    const pct = Math.round((m?.confidence || 0) * 100);
    document.querySelectorAll('.rf-bar').forEach(bar => {
      const v = data.variants[activeVar];
      bar.querySelector('[data-pal]').innerHTML = v.colors.map((c, i) =>
        '<button class="sw" type="button" data-sw="' + i + '" style="background:' + c.hex + '" aria-label="' + c.role + '"></button>'
      ).join('');
      bar.querySelector('[data-vars]').innerHTML = data.variants.map((vv, i) =>
        '<button class="var-btn" type="button" data-var="' + i + '" aria-pressed="' + (i === activeVar) + '">' + vv.label + '</button>'
      ).join('');
      const ds = bar.querySelector('[data-ds]');
      ds.style.setProperty('--ds-pct', pct + '%');
      ds.style.setProperty('--ds-y', '#3d7a4a');
      ds.style.setProperty('--ds-n', '#7a3d3d');
      ds.querySelector('span').textContent = (m?.name || '—') + ' ' + pct + '%';
      const fonts = bar.querySelector('[data-fonts]');
      fonts.innerHTML = '';
      (data.fonts.length ? data.fonts : ['INSP-VALUE']).slice(0, 3).forEach((fname, idx) => {
        const sel = document.createElement('select');
        sel.dataset.font = String(idx + 1);
        FONT_CHOICES.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          if (opt === fname) o.selected = true;
          sel.appendChild(o);
        });
        sel.disabled = !editMode;
        sel.addEventListener('change', () => {
          data.fonts[idx] = sel.value;
          document.documentElement.style.setProperty('--font-' + (idx + 1), fontStack(sel.value));
          pushLog({ kind: 'font-change', font_slot: idx + 1, value: sel.value });
        });
        fonts.appendChild(sel);
      });
      bar.querySelector('[data-n]').textContent = data.variants.length + ' palettes';
      const editBtn = bar.querySelector('[data-act="edit"]');
      if (editBtn) editBtn.setAttribute('aria-pressed', editMode ? 'true' : 'false');
    });
    document.getElementById('foot-nvars').textContent = String(data.variants.length);
    syncSiteLabels();
    void m2;
  }

  function selectVariant(i) {
    activeVar = i;
    applyTokens(data.variants[i].tokens);
    renderTokens(data.variants[i]);
    syncBars();
  }
  function selectModel(i) {
    const prev = data.models[activeModel];
    activeModel = i;
    const chosen = data.models[i];
    const oldConf = chosen.confidence;
    data.models.forEach((m, idx) => { m.confidence = idx === i ? 1 : 0; });
    data.design_system = chosen.name;
    pushLog({
      kind: 'design-system-override',
      chosen: chosen.id,
      chosen_name: chosen.name,
      previous: prev?.id,
      previous_confidence: prev?.confidence,
      was_confidence: oldConf,
      needs_review: true,
      human_or_ai_validation: 'pending'
    });
    syncBars();
    toastMsg('Design system → ' + chosen.name + ' 100% (logged for review)');
  }

  function setEditMode(on) {
    editMode = on;
    document.body.classList.toggle('edit-mode', on);
    cms.hidden = !on;
    document.querySelectorAll('[data-edit]').forEach(el => {
      el.setAttribute('contenteditable', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-site]').forEach(el => {
      el.setAttribute('contenteditable', on ? 'true' : 'false');
    });
    if (!on) {
      // commit fields
      const siteEl = document.querySelector('#site-title [data-edit="site"]');
      if (siteEl) data.site_name = siteEl.textContent.replace(/\\s+/g, ' ').trim() || 'INSP-VALUE';
      const inspEl = document.querySelector('[data-edit="insp"]');
      if (inspEl) data.insp = inspEl.textContent.replace(/\\s+/g, ' ').trim() || 'INSP-VALUE';
      data.copy.body = textOf('body');
      data.copy.footer = textOf('footer');
      data.copy.prompt_example = true;
      persistCopy();
      pushLog({ kind: 'edit-mode-exit' });
    } else {
      pushLog({ kind: 'edit-mode-enter' });
      renderPresetList();
      fillFontPick();
    }
    syncBars();
  }

  function renderPresetList() {
    const bucket = document.getElementById('cms-bucket').value;
    const names = data[bucket] || [];
    const ul = document.getElementById('cms-preset-list');
    ul.innerHTML = names.map((n, i) =>
      '<li><input type="checkbox" data-pi="' + i + '"><span>' + n + '</span></li>'
    ).join('') || '<li style="opacity:.6">(empty)</li>';
  }
  function fillFontPick() {
    const sel = document.getElementById('cms-font-pick');
    sel.innerHTML = FONT_CHOICES.map(f => '<option value="' + f + '">' + f + '</option>').join('');
  }

  document.getElementById('cms-done').addEventListener('click', () => setEditMode(false));
  document.getElementById('cms-bucket').addEventListener('change', renderPresetList);
  document.getElementById('cms-preset-add').addEventListener('click', () => {
    const bucket = document.getElementById('cms-bucket').value;
    const name = window.prompt('Preset name');
    if (!name) return;
    data[bucket].push(name.trim());
    persistLists();
    renderPresetList();
    pushLog({ kind: 'preset-add', bucket, name });
  });
  document.getElementById('cms-preset-del').addEventListener('click', () => {
    const bucket = document.getElementById('cms-bucket').value;
    const boxes = [...document.querySelectorAll('#cms-preset-list input:checked')];
    const idxs = boxes.map(b => Number(b.getAttribute('data-pi'))).sort((a, b) => b - a);
    idxs.forEach(i => data[bucket].splice(i, 1));
    persistLists();
    renderPresetList();
    pushLog({ kind: 'preset-delete', bucket, count: idxs.length });
  });
  document.getElementById('cms-preset-backup').addEventListener('click', () => {
    download('rizzfizz-presets-backup.json', JSON.stringify({
      schema: 'rizzfizz.studio-presets.v1',
      favourites: data.favourites, clients: data.clients, collections: data.collections,
      saves: savedItems
    }, null, 2));
    toastMsg('Preset backup downloaded');
  });
  document.getElementById('cms-preset-restore').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.favourites) data.favourites = json.favourites;
      if (json.clients) data.clients = json.clients;
      if (json.collections) data.collections = json.collections;
      if (json.saves) Object.assign(savedItems, json.saves);
      persistLists();
      saveJson(STORE_SAVES, savedItems);
      renderPresetList();
      toastMsg('Presets restored');
    } catch {
      toastMsg('Invalid preset JSON');
    }
  });
  document.getElementById('cms-font-apply').addEventListener('click', () => {
    const slot = Number(document.getElementById('cms-font-slot').value);
    const name = document.getElementById('cms-font-pick').value;
    data.fonts[slot - 1] = name;
    document.documentElement.style.setProperty('--font-' + slot, fontStack(name));
    syncBars();
    pushLog({ kind: 'font-change', font_slot: slot, value: name, via: 'cms' });
  });
  document.getElementById('cms-font-get').addEventListener('click', () => {
    const name = document.getElementById('cms-font-pick').value;
    if (!name || name === 'INSP-VALUE') { toastMsg('Pick a font first'); return; }
    const id = 'gf-' + name.replace(/\\s+/g, '-');
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + '&display=swap';
      document.head.appendChild(link);
    }
    toastMsg('Loaded ' + name + ' from Google Fonts');
    pushLog({ kind: 'font-download', value: name });
  });
  document.getElementById('cms-palette-load').addEventListener('click', () => {
    try {
      const raw = JSON.parse(document.getElementById('cms-palette-paste').value);
      const tokens = raw.tokens || raw.variants?.[0]?.tokens || raw.palettes?.[0]?.tokens;
      if (!tokens?.paper) throw new Error('no tokens');
      data.variants[activeVar].tokens = tokens;
      data.variants[activeVar].colors = Object.entries(tokens).map(([role, hex]) => ({
        role, hex: String(hex).toUpperCase(), name: role,
        oklch: { l: 0, c: 0, h: 0 }, luminance: 0, contrast_on_paper: 0, contrast_on_ink: 0
      }));
      selectVariant(activeVar);
      pushLog({ kind: 'palette-load', variant: data.variants[activeVar].label });
      toastMsg('Loaded palette into ' + data.variants[activeVar].label);
    } catch {
      toastMsg('Could not parse palette JSON');
    }
  });
  document.getElementById('cms-save-state').addEventListener('click', () => {
    persistCopy();
    download('rizzfizz-studio-state.json', JSON.stringify({
      schema: 'rizzfizz.studio-state.v1',
      site_name: data.site_name, insp: data.insp, fonts: data.fonts,
      copy: data.copy, active_variant: data.variants[activeVar].label,
      design_system: data.models[activeModel],
      variants: data.variants.map(v => ({ id: v.id, label: v.label, tokens: v.tokens }))
    }, null, 2));
    toastMsg('Studio state saved');
  });
  document.getElementById('cms-prompt-copy').addEventListener('click', () => {
    persistCopy();
    download('prompt-copy.json', JSON.stringify({
      schema: 'rizzfizz.prompt-copy.v1',
      body: textOf('body'), footer: textOf('footer'),
      site_name: data.site_name, insp: data.insp,
      usage: 'example_body_and_footer_for_prompts'
    }, null, 2));
    toastMsg('prompt-copy.json downloaded');
  });
  document.getElementById('cms-export-log').addEventListener('click', () => {
    download('rizzfizz-studio-interactions-' + Date.now() + '.jsonl',
      log.map(x => JSON.stringify(x)).join('\\n') + '\\n', 'application/x-ndjson');
    toastMsg('Exported log (' + log.length + ')');
  });

  function openSaveMenu(kind, x, y) {
    const labels = {
      favourites: { title: 'Save to favourites', newLabel: '＋ New favourite list…' },
      clients: { title: 'Save to clients', newLabel: '＋ New client…' },
      collections: { title: 'Save to collections', newLabel: '＋ New collection…' }
    }[kind];
    const items = (data[kind] || []).map(name => ({
      label: name,
      onClick: () => {
        if (!savedItems[kind]) savedItems[kind] = {};
        if (!savedItems[kind][name]) savedItems[kind][name] = [];
        savedItems[kind][name].push({
          at: new Date().toISOString(), site_name: data.site_name,
          variant: data.variants[activeVar].label,
          colors: data.variants[activeVar].colors.map(c => ({ role: c.role, hex: c.hex }))
        });
        saveJson(STORE_SAVES, savedItems);
        pushLog({ kind: 'save-' + kind, list: name });
        toastMsg('Saved → ' + name);
      }
    }));
    items.push({
      label: labels.newLabel,
      onClick: () => {
        const created = window.prompt(labels.title);
        if (!created) return;
        data[kind].push(created.trim());
        persistLists();
        items[items.length - 1].onClick = null;
        openSaveMenu(kind, x, y);
      }
    });
    openMenu(x, y, items, labels.title);
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (menu.classList.contains('open') && !menu.contains(t) && !t.closest('[data-act]')) menu.classList.remove('open');

    const sw = t.closest('[data-sw]');
    if (sw) { showTip(colorTip(data.variants[activeVar].colors[Number(sw.getAttribute('data-sw'))]), e.clientX, e.clientY); return; }
    const vb = t.closest('[data-var]');
    if (vb) { selectVariant(Number(vb.getAttribute('data-var'))); return; }
    const ds = t.closest('[data-ds]');
    if (ds) {
      openMenu(e.clientX, e.clientY, data.models.map((m, i) => ({
        label: m.name + ' · ' + Math.round(m.confidence * 100) + '%',
        onClick: () => selectModel(i)
      })), 'Five umbrella systems — click to set 100% (logged for accuracy review)');
      return;
    }
    const act = t.closest('[data-act]');
    if (act) {
      e.preventDefault();
      const a = act.getAttribute('data-act');
      if (a === 'edit') setEditMode(!editMode);
      else if (a === 'fav') openSaveMenu('favourites', e.clientX, e.clientY);
      else if (a === 'client') openSaveMenu('clients', e.clientX, e.clientY);
      else if (a === 'collections') openSaveMenu('collections', e.clientX, e.clientY);
      else if (a === 'reriff') {
        pushLog({ kind: 'reriff-request', variant: data.variants[activeVar].label });
        toastMsg('Reriff → CLI: rizzfizz reriff --lock …');
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      menu.classList.remove('open');
      if (editMode) setEditMode(false);
    }
  });

  document.addEventListener('mousemove', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const sw = t.closest('[data-sw]');
    if (sw) { showTip(colorTip(data.variants[activeVar].colors[Number(sw.getAttribute('data-sw'))]), e.clientX, e.clientY); return; }
    const vb = t.closest('[data-var]');
    if (vb) { showTip(variantTip(data.variants[Number(vb.getAttribute('data-var'))]), e.clientX, e.clientY); return; }
    const ds = t.closest('[data-ds]');
    if (ds) {
      const lines = data.models.map(m => m.name + ': ' + Math.round(m.confidence * 100) + '%').join('<br>');
      showTip('<b>Design system</b> (5 umbrellas)<br>' + lines + '<br><i>click to override · logged for review</i>', e.clientX, e.clientY);
      return;
    }
    const act = t.closest('[data-act]');
    if (act) { showTip(act.getAttribute('title') || '', e.clientX, e.clientY); return; }
    if (!t.closest('.rf-bar') && !t.closest('.menu')) hideTip();
  });

  document.querySelectorAll('[data-site]').forEach(el => {
    el.addEventListener('blur', () => {
      if (!editMode) return;
      data.site_name = el.textContent.replace(/\\s+/g, ' ').trim() || 'INSP-VALUE';
      persistCopy();
      syncSiteLabels();
    });
  });

  if (data.variants[0]) selectVariant(0);
  data.fonts.forEach((f, i) => {
    document.documentElement.style.setProperty('--font-' + (i + 1), fontStack(f));
  });
  syncSiteLabels();
})();
</script>
</body>
</html>`;
}
