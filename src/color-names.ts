import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio, oklchToHex, parseHexToOklch } from "./color.js";

type ColorEntry = { hex: string; source: string };
type ColorNamesFile = {
  schema: string;
  license_note: string;
  count: number;
  colors: Record<string, ColorEntry>;
};

export type ResolvedColor = {
  name: string;
  hex: string;
  source: string;
  oklch: { l: number; c: number; h: number };
};

type Oklch = { l: number; c: number; h: number };

let cache: {
  byName: Map<string, ColorEntry>;
  names: string[];
  sortedByHue: Array<{ name: string; hex: string; h: number; l: number; c: number }>;
} | null = null;

function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/ → ../data ; src/ → ../data
  return join(here, "..");
}

export function loadColorNames(): Map<string, ColorEntry> {
  ensureLoaded();
  return cache!.byName;
}

function ensureLoaded(): void {
  if (cache) return;
  const path = join(packageRoot(), "data", "color-names.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as ColorNamesFile;
  const byName = new Map<string, ColorEntry>();
  for (const [name, entry] of Object.entries(raw.colors || {})) {
    byName.set(normalizeName(name), { hex: entry.hex.toUpperCase(), source: entry.source });
  }
  const sortedByHue: Array<{ name: string; hex: string; h: number; l: number; c: number }> = [];
  for (const [name, entry] of byName) {
    try {
      const o = parseHexToOklch(entry.hex);
      sortedByHue.push({ name, hex: entry.hex, h: o.h, l: o.l, c: o.c });
    } catch {
      /* skip unparseable */
    }
  }
  sortedByHue.sort((a, b) => a.h - b.h || a.name.localeCompare(b.name));
  cache = { byName, names: [...byName.keys()].sort((a, b) => b.length - a.length), sortedByHue };
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();
}

export function resolveColorName(input: string): ResolvedColor | null {
  ensureLoaded();
  const key = normalizeName(input);
  if (!key) return null;
  if (/^#([0-9a-f]{6})$/i.test(key)) {
    const hex = key.toUpperCase();
    const o = parseHexToOklch(hex);
    return { name: hex, hex, source: "hex", oklch: { l: o.l, c: o.c, h: o.h } };
  }
  const oklchMatch = key.match(/^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/i);
  if (oklchMatch) {
    const lRaw = oklchMatch[1];
    const l = lRaw.endsWith("%") ? Number.parseFloat(lRaw) / 100 : Number.parseFloat(lRaw);
    const c = Number.parseFloat(oklchMatch[2]);
    const h = Number.parseFloat(oklchMatch[3]);
    const hex = oklchToHex({ mode: "oklch", l, c, h });
    return { name: `oklch(${l} ${c} ${h})`, hex, source: "oklch", oklch: { l, c, h } };
  }
  const entry = cache!.byName.get(key);
  if (!entry) return null;
  const o = parseHexToOklch(entry.hex);
  return { name: key, hex: entry.hex, source: entry.source, oklch: { l: o.l, c: o.c, h: o.h } };
}

/** Greedy longest-match of color names across space-separated tokens. */
export function resolveColorPhrase(phrase: string): ResolvedColor[] {
  ensureLoaded();
  const tokens = normalizeName(phrase).split(" ").filter(Boolean);
  const out: ResolvedColor[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched: ResolvedColor | null = null;
    let take = 0;
    for (let len = Math.min(6, tokens.length - i); len >= 1; len--) {
      const candidate = tokens.slice(i, i + len).join(" ");
      const resolved = resolveColorName(candidate);
      if (resolved && resolved.source !== "hex") {
        matched = resolved;
        take = len;
        break;
      }
      // allow bare hex token
      if (len === 1 && resolved) {
        matched = resolved;
        take = 1;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Unknown colour name starting at "${tokens.slice(i).join(" ")}". Try \`rizzfizz colors --search …\`.`);
    }
    out.push(matched);
    i += take;
  }
  return out;
}

export function colorNameCount(): number {
  ensureLoaded();
  return cache!.byName.size;
}

export function searchColorNames(query: string, limit = 20): Array<{ name: string; hex: string; source: string }> {
  ensureLoaded();
  const q = normalizeName(query);
  const hits: Array<{ name: string; hex: string; source: string; score: number }> = [];
  for (const [name, entry] of cache!.byName) {
    if (!name.includes(q)) continue;
    const score = name === q ? 0 : name.startsWith(q) ? 1 : 2;
    hits.push({ name, hex: entry.hex, source: entry.source, score });
  }
  hits.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return hits.slice(0, limit).map(({ name, hex, source }) => ({ name, hex, source }));
}

export function nearestNamedColors(hex: string, n = 3): Array<{ name: string; hex: string; distance: number }> {
  ensureLoaded();
  const target = parseHexToOklch(hex);
  const scored = cache!.sortedByHue.map((row) => ({
    name: row.name,
    hex: row.hex,
    distance: oklchDistance(target, { l: row.l, c: row.c, h: row.h })
  }));
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, n);
}

/** Neighbours on the hue circle among dictionary colors (for spectrum variance).
 *  Skips near-duplicate hues so ±% actually walks the spectrum. */
export function hueNeighbors(hex: string): { prev: { name: string; hex: string; h: number } | null; next: { name: string; hex: string; h: number } | null; hue: number } {
  ensureLoaded();
  const o = parseHexToOklch(hex);
  const list = cache!.sortedByHue;
  if (list.length < 2) return { prev: null, next: null, hue: o.h };
  const MIN_HUE_STEP = 8; // degrees — ignore dictionary clumps at the same hue
  let idx = list.findIndex((row) => row.h >= o.h);
  if (idx < 0) idx = 0;

  let next: (typeof list)[number] | null = null;
  for (let step = 0; step < list.length; step++) {
    const cand = list[(idx + step) % list.length];
    if (Math.abs(hueDeltaToward(o.h, cand.h)) >= MIN_HUE_STEP) {
      next = cand;
      break;
    }
  }
  let prev: (typeof list)[number] | null = null;
  for (let step = 1; step <= list.length; step++) {
    const cand = list[(idx - step + list.length) % list.length];
    if (Math.abs(hueDeltaToward(o.h, cand.h)) >= MIN_HUE_STEP) {
      prev = cand;
      break;
    }
  }
  return {
    prev: prev ? { name: prev.name, hex: prev.hex, h: prev.h } : null,
    next: next ? { name: next.name, hex: next.hex, h: next.h } : null,
    hue: o.h
  };
}

export function hueDeltaToward(fromH: number, toH: number): number {
  let d = toH - fromH;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function oklchDistance(a: Oklch, b: Oklch): number {
  const dL = a.l - b.l;
  const dC = a.c - b.c;
  const dH = hueDeltaToward(a.h, b.h) / 360;
  return Math.sqrt(dL * dL + dC * dC + dH * dH);
}

export function mixTowardHue(base: Oklch, targetHue: number, fraction: number): Oklch {
  const t = Math.max(0, Math.min(1.5, fraction)); // allow slight overshoot past neighbour
  const dH = hueDeltaToward(base.h, targetHue) * t;
  return {
    l: clamp(base.l + (t > 0 ? 0.01 : -0.01) * t, 0.05, 0.98),
    c: Math.max(0, base.c * (1 + 0.05 * t)),
    h: wrapHue(base.h + dH)
  };
}

export function swatchesToDoctrineTokens(swatches: string[]): {
  paper: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  accent_strong: string;
  line: string;
} {
  if (swatches.length === 0) {
    throw new Error("Need at least one swatch to build doctrine tokens");
  }
  const parsed = swatches.map((hex) => ({ hex, o: parseHexToOklch(hex) }));
  const byL = [...parsed].sort((a, b) => a.o.l - b.o.l);
  const byC = [...parsed].sort((a, b) => b.o.c - a.o.c);
  const ink = byL[0].hex;
  const paper = byL[byL.length - 1].hex;
  const panel = byL[Math.min(byL.length - 1, 1)]?.hex || paper;
  const accent = byC[0].hex;
  const accentStrong = byC[Math.min(1, byC.length - 1)].hex;
  const muted = byL[Math.floor(byL.length / 2)].hex;
  let line = paper;
  // prefer a mid tone for line
  for (const row of byL) {
    if (row.o.l > 0.25 && row.o.l < 0.75) {
      line = row.hex;
      break;
    }
  }
  // ensure ink/paper contrast
  if (contrastRatio(ink, paper) < 4.5) {
    return {
      paper: oklchToHex({ mode: "oklch", l: 0.97, c: 0.01, h: parsed[0].o.h }),
      panel: oklchToHex({ mode: "oklch", l: 0.92, c: 0.015, h: parsed[0].o.h }),
      ink: oklchToHex({ mode: "oklch", l: 0.18, c: 0.02, h: parsed[0].o.h }),
      muted: oklchToHex({ mode: "oklch", l: 0.5, c: 0.03, h: parsed[0].o.h }),
      accent,
      accent_strong: accentStrong,
      line: oklchToHex({ mode: "oklch", l: 0.8, c: 0.02, h: parsed[0].o.h })
    };
  }
  return { paper, panel, ink, muted, accent, accent_strong: accentStrong, line };
}

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function formatOklch(o: Oklch): string {
  return `oklch(${o.l.toFixed(3)} ${o.c.toFixed(3)} ${o.h.toFixed(1)})`;
}
