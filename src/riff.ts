import { createHash, randomBytes } from "node:crypto";
import { oklchToHex, parseHexToOklch } from "./color.js";
import {
  formatOklch,
  hueDeltaToward,
  hueNeighbors,
  mixTowardHue,
  nearestNamedColors,
  oklchDistance,
  resolveColorName,
  swatchesToDoctrineTokens,
  type ResolvedColor
} from "./color-names.js";
import { parseLockList, parseRiffSpec, type AllVarianceSpec, type ColorVarianceSpec, type RiffSpec, type VarianceRange } from "./riff-parse.js";

export type RiffSwatch = {
  index: number;
  hex: string;
  oklch: string;
  locked: boolean;
  name?: string;
  roll_percent?: number;
  distance_to_base?: number;
};

export type RiffPalette = {
  id: string;
  version: number;
  swatches: RiffSwatch[];
  tokens: ReturnType<typeof swatchesToDoctrineTokens>;
  roll?: {
    color_index: number;
    percent: number;
    range: VarianceRange;
  };
};

export type RiffWarning = {
  code: "neighbour-overshoot" | "range-past-midpoint" | "unknown-lock" | "contradiction";
  message: string;
  color?: string;
  neighbor?: string;
  requested_percent?: number;
  midpoint_percent?: number;
};

export type RiffRun = {
  schema: "rizzfizz.riff-run.v1";
  created_at: string;
  seed: string;
  source: string;
  spec: {
    raw: string;
    locked: Array<{ name: string; hex: string; source: string }>;
    generated_count: number;
    versions: number;
    variances: RiffSpec["variances"];
  };
  warnings: RiffWarning[];
  flags: {
    seed: string;
    rolls: Array<{
      version: number;
      color_index: number;
      percent: number;
      hex: string;
      oklch: string;
      distance_to_base: number;
      nearest_named: Array<{ name: string; hex: string; distance: number }>;
    }>;
    reriff_hint: string;
  };
  palettes: RiffPalette[];
};

export type RiffOptions = {
  spec: string;
  seed?: string;
  outSource?: string;
};

export type ReriffOptions = {
  previous: RiffRun;
  lock: string[];
  /** Optional replacement / extension of the remaining riff DSL (counts + variance). */
  spec?: string;
  seed?: string;
};

export function runRiff(options: RiffOptions): RiffRun {
  const parsed = parseRiffSpec(options.spec);
  const seed = options.seed || randomBytes(8).toString("hex");
  const rng = mulberry32(hashSeed(seed));
  return buildRiffRun(parsed, seed, rng, options.outSource || `riff:${parsed.raw}`);
}

export function runReriff(options: ReriffOptions): RiffRun {
  const prev = options.previous;
  if (prev.schema !== "rizzfizz.riff-run.v1") {
    throw new Error("reriff requires a rizzfizz.riff-run.v1 document");
  }
  const locks = parseLockList(options.lock);
  if (locks.length === 0) throw new Error("reriff --lock needs at least one colour / hex / oklch");

  // Base DSL from previous, but locked colours from --lock take precedence (first wins).
  const prevRaw = prev.spec.raw;
  const extension = options.spec ? `, ${options.spec}` : "";
  // Rebuild: locked names/hex first, then gen/versions/variance from extension or previous counts.
  const lockPart = locks.map((l) => (l.source === "hex" || l.source === "oklch" ? l.hex : l.name)).join(", ");
  const fallbackTail = `${prev.spec.generated_count}, +${prev.spec.versions}`;
  const composed = options.spec
    ? `${lockPart}${extension.startsWith(",") ? extension : `, ${options.spec}`}`
    : `${lockPart}, ${fallbackTail}`;

  // If contradiction between previous locked names and new locks — keep cmd order (new locks first).
  const seed = options.seed || randomBytes(8).toString("hex");
  const rng = mulberry32(hashSeed(seed));
  const parsed = parseRiffSpec(composed);
  // Force lock list order from --lock (first wins); drop duplicates from parsed.
  const forced: ResolvedColor[] = [...locks];
  for (const c of parsed.locked) {
    if (!forced.some((x) => x.hex === c.hex)) forced.push(c);
  }
  parsed.locked = forced;
  const warnings: RiffWarning[] = [];
  if (options.spec && /lock/i.test(options.spec)) {
    warnings.push({
      code: "contradiction",
      message: "reriff: --lock takes precedence over lock-like tokens in the trailing spec (first-wins)."
    });
  }
  const run = buildRiffRun(parsed, seed, rng, `reriff:${prev.seed}`);
  run.warnings = [...warnings, ...run.warnings];
  run.spec.raw = `reriff lock(${options.lock.join(", ")}) from ${prevRaw}`;
  return run;
}

function buildRiffRun(parsed: RiffSpec, seed: string, rng: () => number, source: string): RiffRun {
  const warnings = collectVarianceWarnings(parsed);
  const baseSwatches = buildBaseSwatches(parsed, rng);
  const palettes: RiffPalette[] = [];
  const rolls: RiffRun["flags"]["rolls"] = [];

  for (let v = 0; v < parsed.versions; v++) {
    const { swatches, roll } = applyVersionVariance(baseSwatches, parsed, v, rng);
    const hexes = swatches.map((s) => s.hex);
    const tokens = swatchesToDoctrineTokens(hexes);
    const id = `riff-${v + 1}`;
    palettes.push({
      id,
      version: v + 1,
      swatches,
      tokens,
      roll: roll || undefined
    });
    if (roll) {
      const base = baseSwatches[roll.color_index];
      const dist = oklchDistance(parseHexToOklch(base.hex), parseHexToOklch(swatches[roll.color_index].hex));
      rolls.push({
        version: v + 1,
        color_index: roll.color_index,
        percent: roll.percent,
        hex: swatches[roll.color_index].hex,
        oklch: swatches[roll.color_index].oklch,
        distance_to_base: Number(dist.toFixed(5)),
        nearest_named: nearestNamedColors(swatches[roll.color_index].hex, 3)
      });
    }
  }

  const lockArgs = rolls.length
    ? rolls.map((r) => r.hex).slice(0, 3).join(",")
    : parsed.locked.map((l) => l.hex).join(",");

  return {
    schema: "rizzfizz.riff-run.v1",
    created_at: new Date().toISOString(),
    seed,
    source,
    spec: {
      raw: parsed.raw,
      locked: parsed.locked.map((l) => ({ name: l.name, hex: l.hex, source: l.source })),
      generated_count: parsed.generatedCount,
      versions: parsed.versions,
      variances: parsed.variances
    },
    warnings,
    flags: {
      seed,
      rolls,
      reriff_hint: `rizzfizz reriff --lock ${lockArgs || "#000000"} --seed ${seed}`
    },
    palettes
  };
}

function buildBaseSwatches(parsed: RiffSpec, rng: () => number): RiffSwatch[] {
  const swatches: RiffSwatch[] = parsed.locked.map((c, index) => ({
    index,
    hex: c.hex,
    oklch: formatOklch(c.oklch),
    locked: true,
    name: c.name
  }));

  const lockedHues = parsed.locked.map((c) => c.oklch.h);
  const avgL = parsed.locked.reduce((s, c) => s + c.oklch.l, 0) / Math.max(1, parsed.locked.length);
  const avgC = parsed.locked.reduce((s, c) => s + c.oklch.c, 0) / Math.max(1, parsed.locked.length);

  for (let g = 0; g < parsed.generatedCount; g++) {
    const hue = pickSeparatedHue(lockedHues.concat(swatches.filter((s) => !s.locked).map((s) => parseHexToOklch(s.hex).h)), rng);
    const l = clamp(avgL + (rng() - 0.5) * 0.2, 0.2, 0.85);
    const c = clamp(Math.max(0.04, avgC) + (rng() - 0.5) * 0.06, 0.02, 0.22);
    const hex = oklchToHex({ mode: "oklch", l, c, h: hue });
    swatches.push({
      index: swatches.length,
      hex,
      oklch: formatOklch({ l, c, h: hue }),
      locked: false,
      name: nearestNamedColors(hex, 1)[0]?.name
    });
  }
  return swatches;
}

function applyVersionVariance(
  base: RiffSwatch[],
  parsed: RiffSpec,
  versionIndex: number,
  rng: () => number
): { swatches: RiffSwatch[]; roll: RiffPalette["roll"] | null } {
  const swatches = base.map((s) => ({ ...s }));
  const colorVars = parsed.variances.filter((v): v is ColorVarianceSpec => v.kind === "color");
  const allVars = parsed.variances.filter((v): v is AllVarianceSpec => v.kind === "all");

  let roll: RiffPalette["roll"] | null = null;

  // Per-color variance: apply to matching locked/base colour every version
  for (const spec of colorVars) {
    const idx = swatches.findIndex((s) => s.name === spec.name || normalizeMatch(s.name) === normalizeMatch(spec.name));
    if (idx < 0) continue;
    const percent = rollPercent(spec.range, rng);
    swatches[idx] = shiftSwatch(swatches[idx], percent);
    roll = { color_index: idx, percent, range: spec.range };
  }

  // ~ALL: pick one colour once per version within the version's range
  for (const spec of allVars) {
    const range = spec.ranges[Math.min(versionIndex, spec.ranges.length - 1)];
    const unlockedIdx = swatches.map((_, i) => i).filter((i) => !swatches[i].locked);
    const pool = unlockedIdx.length > 0 ? unlockedIdx : swatches.map((_, i) => i);
    const idx = pool[Math.floor(rng() * pool.length)] ?? 0;
    const percent = rollPercent(range, rng);
    swatches[idx] = shiftSwatch(base[idx], percent);
    roll = { color_index: idx, percent, range };
  }

  // If no variance specs, still nudge unlocked colours slightly per version for distinctness
  if (colorVars.length === 0 && allVars.length === 0 && parsed.versions > 1) {
    for (let i = 0; i < swatches.length; i++) {
      if (swatches[i].locked) continue;
      const percent = (rng() - 0.5) * 10; // ±5%
      swatches[i] = shiftSwatch(base[i], percent);
    }
  }

  return { swatches, roll };
}

function shiftSwatch(swatch: RiffSwatch, percent: number): RiffSwatch {
  const base = parseHexToOklch(swatch.hex);
  const neighbors = hueNeighbors(swatch.hex);
  const toward = percent >= 0 ? neighbors.next : neighbors.prev;
  if (!toward) return swatch;
  const fraction = Math.abs(percent) / 100;
  const mixed = mixTowardHue(base, toward.h, fraction);
  const hex = oklchToHex({ mode: "oklch", l: mixed.l, c: mixed.c, h: mixed.h });
  const dist = oklchDistance(base, mixed);
  return {
    ...swatch,
    hex,
    oklch: formatOklch(mixed),
    roll_percent: Number(percent.toFixed(3)),
    distance_to_base: Number(dist.toFixed(5))
  };
}

function collectVarianceWarnings(parsed: RiffSpec): RiffWarning[] {
  const warnings: RiffWarning[] = [];
  for (const v of parsed.variances) {
    if (v.kind === "color") {
      const color = resolveColorName(v.name);
      if (!color) continue;
      warnings.push(...rangeWarningsForColor(color, v.range));
    }
    if (v.kind === "all") {
      for (const locked of parsed.locked) {
        for (const range of v.ranges) {
          warnings.push(...rangeWarningsForColor(locked, range));
        }
      }
    }
  }
  // Multi-lock: warn if variance on one could collide with another locked colour
  if (parsed.locked.length >= 2) {
    for (let i = 0; i < parsed.locked.length; i++) {
      for (let j = i + 1; j < parsed.locked.length; j++) {
        const a = parsed.locked[i];
        const b = parsed.locked[j];
        const dist = oklchDistance(a.oklch, b.oklch);
        if (dist < 0.08) {
          warnings.push({
            code: "neighbour-overshoot",
            message: `Locked colours "${a.name}" and "${b.name}" are very close (Δ=${dist.toFixed(3)}); variance may collide.`,
            color: a.name,
            neighbor: b.name
          });
        }
      }
    }
  }
  return dedupeWarnings(warnings);
}

function rangeWarningsForColor(color: ResolvedColor, range: VarianceRange): RiffWarning[] {
  const warnings: RiffWarning[] = [];
  const neighbors = hueNeighbors(color.hex);
  for (const [side, percent] of [["plus", range.plus], ["minus", range.minus]] as const) {
    if (percent <= 0) continue;
    const neighbor = side === "plus" ? neighbors.next : neighbors.prev;
    if (!neighbor) continue;
    // Midpoint toward neighbour ≈ 50% of the local spectrum step
    if (percent > 50) {
      warnings.push({
        code: "range-past-midpoint",
        message: `Variance ${side === "plus" ? "+" : "-"}${percent}% on "${color.name}" passes the midpoint toward neighbour "${neighbor.name}" (${neighbor.hex}).`,
        color: color.name,
        neighbor: neighbor.name,
        requested_percent: percent,
        midpoint_percent: 50
      });
    }
    if (percent >= 100) {
      warnings.push({
        code: "neighbour-overshoot",
        message: `Variance ${side === "plus" ? "+" : "-"}${percent}% on "${color.name}" reaches/overshoots neighbour "${neighbor.name}" on the hue spectrum.`,
        color: color.name,
        neighbor: neighbor.name,
        requested_percent: percent
      });
    }
  }
  return warnings;
}

function pickSeparatedHue(existing: number[], rng: () => number): number {
  let best = rng() * 360;
  let bestScore = -1;
  for (let attempt = 0; attempt < 24; attempt++) {
    const h = rng() * 360;
    const score = existing.length === 0
      ? 1
      : Math.min(...existing.map((e) => Math.abs(hueDeltaToward(e, h))));
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

function rollPercent(range: VarianceRange, rng: () => number): number {
  const min = -Math.abs(range.minus);
  const max = Math.abs(range.plus);
  if (min === 0 && max === 0) return 0;
  return min + rng() * (max - min);
}

function normalizeMatch(name?: string): string {
  return (name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeWarnings(warnings: RiffWarning[]): RiffWarning[] {
  const seen = new Set<string>();
  const out: RiffWarning[] = [];
  for (const w of warnings) {
    const key = `${w.code}|${w.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

function hashSeed(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0);
}

function mulberry32(a: number): () => number {
  return function rng() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function formatRiffFlags(run: RiffRun): string {
  const lines = [
    `FLAG seed=${run.flags.seed}`,
    `FLAG versions=${run.palettes.length}`,
    `FLAG locked=${run.spec.locked.map((l) => `${l.name}:${l.hex}`).join(" | ") || "(none)"}`,
    `FLAG generated_count=${run.spec.generated_count}`
  ];
  for (const w of run.warnings) {
    lines.push(`WARN ${w.code}: ${w.message}`);
  }
  for (const roll of run.flags.rolls) {
    lines.push(
      `FLAG roll v${roll.version} color[${roll.color_index}]=${roll.hex} percent=${roll.percent.toFixed(3)} Δbase=${roll.distance_to_base} nearest=${roll.nearest_named.map((n) => n.name).join(",")}`
    );
  }
  lines.push(`FLAG reriff_hint=${run.flags.reriff_hint}`);
  return lines.join("\n");
}
