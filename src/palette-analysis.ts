import zlib from "node:zlib";
import culori from "./culori-require.js";
import { contrastRatio } from "./color.js";

export type PaletteColorRole = "background" | "surface" | "text" | "muted" | "accent" | "border" | "unknown";
export type PaletteColorSourceKind = "custom-property" | "css-declaration" | "html-style" | "html-class" | "literal" | "a-eyes-json" | "a-eyes-png";

export type ExtractedPaletteColor = {
  hex: string;
  original: string;
  role: PaletteColorRole;
  source_kind: PaletteColorSourceKind;
  name?: string;
  property?: string;
  oklch: {
    l: number;
    c: number;
    h: number;
  };
  evidence?: string;
  count: number;
};

export type PaletteRoleCoverage = Record<Exclude<PaletteColorRole, "unknown">, { present: boolean; count: number }> & {
  score: number;
};

export type PaletteContrastSignal = {
  foreground: string;
  background: string;
  foreground_role: PaletteColorRole;
  background_role: PaletteColorRole;
  ratio: number;
  level: "pass" | "warn" | "fail";
};

export type PaletteQualityReport = {
  schema: "rizzfizz.palette-analysis.v1";
  source_safe: true;
  extracted_colors: ExtractedPaletteColor[];
  role_coverage: PaletteRoleCoverage;
  contrast: {
    checked_pairs: PaletteContrastSignal[];
    best_text_on_background?: PaletteContrastSignal;
    worst_text_on_background?: PaletteContrastSignal;
    passing_pairs: number;
    failing_pairs: number;
  };
  oklch: {
    lightness_range: number;
    average_lightness: number;
    average_chroma: number;
    max_chroma: number;
    accent_chroma_delta: number;
    hue_clusters: Array<{ hue: number; count: number }>;
    harmony: "monochrome" | "analogous" | "complementary" | "split" | "multi-hue" | "unknown";
  };
  quality_score: number;
  warnings: string[];
  summary: string;
};

export type PaletteAnalysisReport = PaletteQualityReport & {
  inputs: {
    html?: "redacted-local-path";
    css?: "redacted-local-path";
  };
};

type SourceInput = { css?: string; html?: string; text?: string };
type AEyesArtifactInput = { json?: unknown; png?: Uint8Array };
type VarMap = Map<string, string>;

type Candidate = {
  value: string;
  role: PaletteColorRole;
  source_kind: PaletteColorSourceKind;
  name?: string;
  property?: string;
  count?: number;
};

const COLOR_PROPERTY_RE = /(?:^|[;{\s])([\w-]*(?:color|background|bg|fill|stroke|border|shadow|outline|decoration|accent)[\w-]*)\s*:\s*([^;{}<>]+)/gi;
const CUSTOM_PROP_RE = /(--[\w-]*(?:color|bg|background|surface|paper|panel|text|fg|foreground|ink|muted|accent|brand|primary|cta|link|border|line|stroke)[\w-]*)\s*:\s*([^;{}<>]+)/gi;
const STYLE_ATTR_RE = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
const FUNCTION_COLOR_RE = /\b(?:rgb|rgba|hsl|hsla|oklab|oklch|lab|lch)\([^)]*\)/gi;
const TAILWIND_ARBITRARY_COLOR_RE = /(?:bg|text|border|from|via|to|fill|stroke)-\[(#[0-9a-fA-F]{3,8}|(?:rgb|hsl|oklch|oklab|lab|lch)\([^\]]+\))\]/g;
const VAR_RE = /var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)/gi;

const toOklch = culori.converter("oklch");
const toRgb = culori.converter("rgb");

export function extractPaletteColorsFromSource(input: SourceInput): ExtractedPaletteColor[] {
  const css = input.css || "";
  const html = input.html || "";
  const text = [input.text || "", css, html].filter(Boolean).join("\n");
  const varMap = buildCustomPropertyMap(text);
  const candidates: Candidate[] = [];

  collectCustomProperties(text, varMap, candidates);
  collectDeclarations(css, "css-declaration", varMap, candidates);
  collectInlineStyles(html, varMap, candidates);
  collectTailwindArbitraryColors(html, candidates);
  collectLooseLiterals(text, candidates);

  return normalizeCandidates(candidates, varMap);
}

export function extractPaletteColorsFromAEyesArtifact(input: AEyesArtifactInput): ExtractedPaletteColor[] {
  const candidates: Candidate[] = [];
  if (input.json != null) {
    const json = typeof input.json === "string" ? safeJsonParse(input.json) : input.json;
    collectAEyesJsonColors(json, candidates);
  }
  if (input.png) {
    collectPngDominantColors(input.png, candidates);
  }
  return normalizeCandidates(candidates);
}

function normalizeCandidates(candidates: Candidate[], varMap: VarMap = new Map()): ExtractedPaletteColor[] {
  const deduped = new Map<string, ExtractedPaletteColor>();
  for (const candidate of candidates) {
    const hex = normalizeCssColor(candidate.value, varMap);
    if (!hex) continue;
    const oklch = hexToOklch(hex);
    if (!oklch) continue;
    const role = candidate.role === "unknown" ? inferRole([candidate.name, candidate.property, candidate.value].filter(Boolean).join(" ")) : candidate.role;
    const key = `${hex}|${role}|${candidate.source_kind}|${candidate.name || ""}|${candidate.property || ""}`;
    const existing = deduped.get(key);
    const count = Math.max(1, Math.round(candidate.count || 1));
    if (existing) {
      existing.count += count;
    } else {
      deduped.set(key, {
        hex,
        original: safeOriginal(candidate.value),
        role,
        source_kind: candidate.source_kind,
        name: candidate.name,
        property: candidate.property,
        oklch,
        evidence: safeEvidence(candidate),
        count
      });
    }
  }

  return [...deduped.values()].sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || b.count - a.count || a.hex.localeCompare(b.hex));
}

export function scorePaletteQuality(colors: ExtractedPaletteColor[]): PaletteQualityReport {
  const role_coverage = computeRoleCoverage(colors);
  const contrast = computeContrastSignals(colors);
  const oklch = computeOklchMetrics(colors);
  const warnings = buildWarnings(role_coverage, contrast, oklch, colors.length);
  const score = clamp(
    Math.round(
      role_coverage.score * 40 +
      contrastScore(contrast) * 30 +
      oklchScore(oklch) * 20 +
      Math.min(1, colors.length / 6) * 10
    ),
    0,
    100
  );

  return {
    schema: "rizzfizz.palette-analysis.v1",
    source_safe: true,
    extracted_colors: colors,
    role_coverage,
    contrast,
    oklch,
    quality_score: score,
    warnings,
    summary: `Palette quality ${score}/100 with ${Math.round(role_coverage.score * 100)}% role coverage, ${contrast.passing_pairs} passing contrast signal(s), ${oklch.harmony} OKLCH harmony.`
  };
}

export function analyzePaletteFromSource(input: SourceInput): PaletteAnalysisReport {
  const scored = scorePaletteQuality(extractPaletteColorsFromSource(input));
  return {
    ...scored,
    inputs: {
      ...(input.html != null ? { html: "redacted-local-path" as const } : {}),
      ...(input.css != null ? { css: "redacted-local-path" as const } : {})
    }
  };
}


function collectAEyesJsonColors(value: unknown, candidates: Candidate[], path: string[] = []): void {
  if (value == null) return;
  if (typeof value === "string") {
    for (const color of extractColorValues(value, new Map())) {
      candidates.push({ value: color, role: inferRole(path.join(" ")), source_kind: "a-eyes-json", name: safeArtifactKey(path) });
    }
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length >= 3 && value.slice(0, 3).every((item) => typeof item === "number")) {
      const [r, g, b] = value as number[];
      candidates.push({ value: `rgb(${r} ${g} ${b})`, role: inferRole(path.join(" ")), source_kind: "a-eyes-json", name: safeArtifactKey(path) });
      return;
    }
    value.forEach((item, index) => collectAEyesJsonColors(item, candidates, [...path, `item-${index}`]));
    return;
  }
  const object = value as Record<string, unknown>;
  const role = coerceRole(object.role) || inferRole(path.join(" "));
  const count = numericField(object, ["count", "pixels", "pixel_count", "population"]);
  for (const key of ["hex", "color", "value", "dominant", "background", "foreground", "accent"] as const) {
    if (typeof object[key] === "string") {
      candidates.push({ value: object[key], role: coerceRole(String(key)) || role, source_kind: "a-eyes-json", name: safeArtifactKey([...path, key]), count: count || coverageCount(object) });
    }
  }
  if (Array.isArray(object.rgb) && object.rgb.length >= 3 && object.rgb.slice(0, 3).every((item) => typeof item === "number")) {
    const [r, g, b] = object.rgb as number[];
    candidates.push({ value: `rgb(${r} ${g} ${b})`, role, source_kind: "a-eyes-json", name: safeArtifactKey([...path, "rgb"]), count: count || coverageCount(object) });
  }
  for (const [key, child] of Object.entries(object)) {
    if (["hex", "color", "value", "dominant", "background", "foreground", "accent", "rgb", "role", "count", "pixels", "pixel_count", "population", "coverage"].includes(key)) continue;
    collectAEyesJsonColors(child, candidates, [...path, key]);
  }
}

function collectPngDominantColors(png: Uint8Array, candidates: Candidate[]): void {
  for (const color of decodeSimplePngDominantColors(Buffer.from(png))) {
    candidates.push({ value: color.hex, role: inferRoleFromOklchColor(color.hex), source_kind: "a-eyes-png", name: "dominant-png-color", count: color.count });
  }
}

function decodeSimplePngDominantColors(buffer: Buffer): Array<{ hex: string; count: number }> {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return [];
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) return [];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || idat.length === 0) return [];
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const counts = new Map<string, number>();
  let previous = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor++];
    const row = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    unfilterPngRow(row, previous, bytesPerPixel, filter);
    for (let x = 0; x < width; x += 1) {
      const i = x * bytesPerPixel;
      const alpha = bytesPerPixel === 4 ? row[i + 3] : 255;
      if (alpha < 13) continue;
      const hex = rgbToHex(row[i], row[i + 1], row[i + 2]);
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    previous = row;
  }
  return [...counts.entries()].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex)).slice(0, 16);
}

function unfilterPngRow(row: Buffer, previous: Buffer, bpp: number, filter: number): void {
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = previous[i] || 0;
    const upLeft = i >= bpp ? previous[i - bpp] || 0 : 0;
    if (filter === 1) row[i] = (row[i] + left) & 0xff;
    else if (filter === 2) row[i] = (row[i] + up) & 0xff;
    else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 0xff;
    else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function inferRoleFromOklchColor(hex: string): PaletteColorRole {
  const oklch = hexToOklch(hex);
  if (!oklch) return "unknown";
  if (oklch.l < 0.24) return "background";
  if (oklch.l > 0.88 && oklch.c < 0.05) return "text";
  if (oklch.c > 0.12) return "accent";
  if (oklch.l < 0.45) return "surface";
  if (oklch.l > 0.55 && oklch.c < 0.08) return "muted";
  return "unknown";
}

function safeJsonParse(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

function coerceRole(value: unknown): PaletteColorRole | undefined {
  if (typeof value !== "string") return undefined;
  const role = inferRole(value);
  return role === "unknown" ? undefined : role;
}

function numericField(object: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function coverageCount(object: Record<string, unknown>): number | undefined {
  const coverage = object.coverage;
  return typeof coverage === "number" && Number.isFinite(coverage) && coverage > 0 ? Math.max(1, Math.round(coverage * 1000)) : undefined;
}

function safeArtifactKey(path: string[]): string | undefined {
  if (path.length === 0) return undefined;
  return path.map((item) => item.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 32)).join(".").slice(0, 120);
}

function buildCustomPropertyMap(text: string): VarMap {
  const map: VarMap = new Map();
  for (const match of text.matchAll(CUSTOM_PROP_RE)) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

function collectCustomProperties(text: string, varMap: VarMap, candidates: Candidate[]): void {
  for (const match of text.matchAll(CUSTOM_PROP_RE)) {
    const name = match[1];
    const value = match[2].trim();
    for (const color of extractColorValues(value, varMap)) {
      candidates.push({ value: color, role: inferRole(name), source_kind: "custom-property", name });
    }
  }
}

function collectDeclarations(text: string, kind: PaletteColorSourceKind, varMap: VarMap, candidates: Candidate[]): void {
  for (const match of text.matchAll(COLOR_PROPERTY_RE)) {
    const property = match[1].trim();
    if (property.startsWith("--")) continue;
    const value = match[2].trim();
    for (const color of extractColorValues(value, varMap)) {
      candidates.push({ value: color, role: inferRole(`${property} ${value}`), source_kind: kind, property });
    }
  }
}

function collectInlineStyles(html: string, varMap: VarMap, candidates: Candidate[]): void {
  for (const match of html.matchAll(STYLE_ATTR_RE)) {
    collectDeclarations(match[1] || match[2] || "", "html-style", varMap, candidates);
  }
}

function collectTailwindArbitraryColors(html: string, candidates: Candidate[]): void {
  for (const match of html.matchAll(TAILWIND_ARBITRARY_COLOR_RE)) {
    const utility = match[0].slice(0, match[0].indexOf("-["));
    candidates.push({ value: match[1], role: inferRole(utility), source_kind: "html-class", property: utility });
  }
}

function collectLooseLiterals(text: string, candidates: Candidate[]): void {
  for (const color of text.matchAll(HEX_RE)) candidates.push({ value: color[0], role: "unknown", source_kind: "literal" });
  for (const color of text.matchAll(FUNCTION_COLOR_RE)) candidates.push({ value: color[0], role: "unknown", source_kind: "literal" });
}

function extractColorValues(value: string, varMap: VarMap): string[] {
  const values: string[] = [];
  for (const match of value.matchAll(VAR_RE)) {
    const resolved = resolveVar(match[1], varMap);
    if (resolved) values.push(...extractColorValues(resolved, varMap));
    else if (match[2]) values.push(...extractColorValues(match[2], varMap));
  }
  for (const match of value.matchAll(HEX_RE)) values.push(match[0]);
  for (const match of value.matchAll(FUNCTION_COLOR_RE)) values.push(match[0]);
  return values.length ? values : [value];
}

function resolveVar(name: string, varMap: VarMap, seen = new Set<string>()): string | undefined {
  if (seen.has(name)) return undefined;
  seen.add(name);
  const value = varMap.get(name);
  if (!value) return undefined;
  const varMatch = value.match(/^var\(\s*(--[\w-]+)/);
  if (varMatch) return resolveVar(varMatch[1], varMap, seen) || value;
  return value;
}

function normalizeCssColor(value: string, varMap: VarMap): string | undefined {
  const trimmed = value.trim().replace(/!important\b/i, "").trim();
  if (!trimmed || /transparent|currentColor|inherit|initial|unset/i.test(trimmed)) return undefined;
  const varMatch = trimmed.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)$/i);
  if (varMatch) return normalizeCssColor(resolveVar(varMatch[1], varMap) || varMatch[2] || "", varMap);
  const parsed = culori.parse(trimmed);
  if (!parsed) return undefined;
  const rgb = toRgb(parsed);
  if (!rgb || (typeof rgb.alpha === "number" && rgb.alpha < 0.05)) return undefined;
  return culori.formatHex(culori.clampRgb(rgb)).toUpperCase();
}

function hexToOklch(hex: string): ExtractedPaletteColor["oklch"] | undefined {
  const parsed = culori.parse(hex);
  const converted = parsed ? toOklch(parsed) : undefined;
  if (!converted || typeof converted.l !== "number" || typeof converted.c !== "number") return undefined;
  return {
    l: round(converted.l, 4),
    c: round(converted.c ?? 0, 4),
    h: round(typeof converted.h === "number" ? converted.h : 0, 2)
  };
}

function inferRole(text: string): PaletteColorRole {
  const lower = text.toLowerCase();
  if (/accent|brand|primary|cta|link|active|focus|selected/.test(lower)) return "accent";
  if (/muted|secondary|subtle|placeholder|disabled/.test(lower)) return "muted";
  if (/border|line|stroke|outline|divider|rule/.test(lower)) return "border";
  if (/text|foreground|fg|ink|copy|content|heading/.test(lower) || /^color\b/.test(lower)) return "text";
  if (/surface|panel|card|sheet|elevated|popover|modal/.test(lower)) return "surface";
  if (/background|bg|paper|canvas|page|body|base/.test(lower)) return "background";
  return "unknown";
}

function computeRoleCoverage(colors: ExtractedPaletteColor[]): PaletteRoleCoverage {
  const roles: Array<Exclude<PaletteColorRole, "unknown">> = ["background", "surface", "text", "muted", "accent", "border"];
  const entries = Object.fromEntries(roles.map((role) => {
    const count = colors.filter((color) => color.role === role).length;
    return [role, { present: count > 0, count }];
  })) as Omit<PaletteRoleCoverage, "score">;
  const weights: Record<Exclude<PaletteColorRole, "unknown">, number> = {
    background: 0.2,
    surface: 0.15,
    text: 0.2,
    muted: 0.12,
    accent: 0.2,
    border: 0.13
  };
  const score = round(roles.reduce((sum, role) => sum + (entries[role].present ? weights[role] : 0), 0), 3);
  return { ...entries, score };
}

function computeContrastSignals(colors: ExtractedPaletteColor[]): PaletteQualityReport["contrast"] {
  const foregrounds = colors.filter((color) => ["text", "muted", "accent", "unknown"].includes(color.role));
  const backgrounds = colors.filter((color) => ["background", "surface", "unknown"].includes(color.role));
  const checked_pairs: PaletteContrastSignal[] = [];

  for (const foreground of foregrounds) {
    for (const background of backgrounds) {
      if (foreground.hex === background.hex) continue;
      const ratio = contrastRatio(foreground.hex, background.hex);
      const threshold = foreground.role === "text" ? 4.5 : 3;
      checked_pairs.push({
        foreground: foreground.hex,
        background: background.hex,
        foreground_role: foreground.role,
        background_role: background.role,
        ratio,
        level: ratio >= threshold ? "pass" : ratio >= 2.2 ? "warn" : "fail"
      });
    }
  }

  const textPairs = checked_pairs.filter((pair) => pair.foreground_role === "text" && ["background", "surface", "unknown"].includes(pair.background_role));
  const sortedTextPairs = [...textPairs].sort((a, b) => b.ratio - a.ratio);
  return {
    checked_pairs: checked_pairs.sort((a, b) => b.ratio - a.ratio).slice(0, 24),
    best_text_on_background: sortedTextPairs[0],
    worst_text_on_background: sortedTextPairs.at(-1),
    passing_pairs: checked_pairs.filter((pair) => pair.level === "pass").length,
    failing_pairs: checked_pairs.filter((pair) => pair.level === "fail").length
  };
}

function computeOklchMetrics(colors: ExtractedPaletteColor[]): PaletteQualityReport["oklch"] {
  if (colors.length === 0) {
    return { lightness_range: 0, average_lightness: 0, average_chroma: 0, max_chroma: 0, accent_chroma_delta: 0, hue_clusters: [], harmony: "unknown" };
  }
  const lightness = colors.map((color) => color.oklch.l);
  const chroma = colors.map((color) => color.oklch.c);
  const chromatic = colors.filter((color) => color.oklch.c >= 0.025);
  const clusters = hueClusters(chromatic);
  const nonAccentAvgChroma = average(colors.filter((color) => color.role !== "accent").map((color) => color.oklch.c));
  const accentAvgChroma = average(colors.filter((color) => color.role === "accent").map((color) => color.oklch.c));
  return {
    lightness_range: round(Math.max(...lightness) - Math.min(...lightness), 4),
    average_lightness: round(average(lightness), 4),
    average_chroma: round(average(chroma), 4),
    max_chroma: round(Math.max(...chroma), 4),
    accent_chroma_delta: round(Math.max(0, accentAvgChroma - nonAccentAvgChroma), 4),
    hue_clusters: clusters,
    harmony: classifyHarmony(clusters)
  };
}

function hueClusters(colors: ExtractedPaletteColor[]): Array<{ hue: number; count: number }> {
  const buckets = new Map<number, number>();
  for (const color of colors) {
    const bucket = Math.round(color.oklch.h / 30) * 30 % 360;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }
  return [...buckets.entries()]
    .map(([hue, count]) => ({ hue, count }))
    .sort((a, b) => b.count - a.count || a.hue - b.hue)
    .slice(0, 6);
}

function classifyHarmony(clusters: Array<{ hue: number; count: number }>): PaletteQualityReport["oklch"]["harmony"] {
  if (clusters.length === 0) return "unknown";
  if (clusters.length === 1) return "monochrome";
  const hues = clusters.map((cluster) => cluster.hue);
  const maxDistance = Math.max(...hues.flatMap((hue) => hues.map((other) => circularHueDistance(hue, other))));
  if (maxDistance <= 60) return "analogous";
  if (hues.some((hue) => hues.some((other) => circularHueDistance(hue, other) >= 150 && circularHueDistance(hue, other) <= 210))) return clusters.length > 2 ? "split" : "complementary";
  return "multi-hue";
}

function buildWarnings(
  coverage: PaletteRoleCoverage,
  contrast: PaletteQualityReport["contrast"],
  oklch: PaletteQualityReport["oklch"],
  colorCount: number
): string[] {
  const warnings: string[] = [];
  for (const role of ["background", "surface", "text", "muted", "accent", "border"] as const) {
    if (!coverage[role].present) warnings.push(`Missing ${role} role signal.`);
  }
  if (!contrast.best_text_on_background) warnings.push("No text-on-background contrast signal could be computed.");
  else if (contrast.best_text_on_background.ratio < 4.5) warnings.push(`Best text/background contrast ${contrast.best_text_on_background.ratio}:1 is below WCAG AA body text threshold.`);
  if (oklch.lightness_range < 0.35) warnings.push("OKLCH lightness range is narrow; hierarchy may be flat.");
  if (coverage.accent.present && oklch.accent_chroma_delta < 0.025) warnings.push("Accent chroma is not clearly separated from the base palette.");
  if (colorCount < 4) warnings.push("Few colors extracted; score is provisional.");
  return warnings;
}

function contrastScore(contrast: PaletteQualityReport["contrast"]): number {
  if (!contrast.best_text_on_background) return 0;
  const best = Math.min(1, contrast.best_text_on_background.ratio / 7);
  const failurePenalty = Math.min(0.35, contrast.failing_pairs * 0.03);
  return clamp(best - failurePenalty, 0, 1);
}

function oklchScore(oklch: PaletteQualityReport["oklch"]): number {
  const lightness = clamp(oklch.lightness_range / 0.75, 0, 1) * 0.45;
  const chroma = clamp(oklch.max_chroma / 0.16, 0, 1) * 0.3;
  const accent = clamp(oklch.accent_chroma_delta / 0.08, 0, 1) * 0.15;
  const harmony = oklch.harmony === "unknown" ? 0 : 0.1;
  return lightness + chroma + accent + harmony;
}

function safeOriginal(value: string): string {
  return value.trim().replace(/url\([^)]*\)/gi, "url(redacted)").slice(0, 120);
}

function safeEvidence(candidate: Candidate): string | undefined {
  if (candidate.name) return candidate.name;
  if (candidate.property) return candidate.property;
  return undefined;
}

function roleOrder(role: PaletteColorRole): number {
  return ["background", "surface", "text", "muted", "accent", "border", "unknown"].indexOf(role);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
