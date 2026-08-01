import { normalizeName, resolveColorName, resolveColorPhrase, type ResolvedColor } from "./color-names.js";

export type VarianceRange = { minus: number; plus: number };

export type ColorVarianceSpec = {
  kind: "color";
  name: string;
  range: VarianceRange;
};

export type AllVarianceSpec = {
  kind: "all";
  /** One range applied to every version, or per-version ranges. */
  ranges: VarianceRange[];
};

export type VarianceSpec = ColorVarianceSpec | AllVarianceSpec;

export type RiffSpec = {
  locked: ResolvedColor[];
  generatedCount: number;
  versions: number;
  variances: VarianceSpec[];
  raw: string;
};

/**
 * Parse a riff DSL string.
 *
 * Examples:
 *   blue
 *   orange, dark blue grey, 3, +3
 *   blue green, 3, +5
 *   ~blue(+10), 3, 3
 *   ~yellow sun(20), orange
 *   ~grey green(-23, +10)
 *   ~ALL(10)
 *   ~ALL(-35,-20,-10)
 */
export function parseRiffSpec(input: string): RiffSpec {
  let raw = String(input || "").trim();
  raw = raw.replace(/^riff\s*/i, "");
  if (!raw) throw new Error("riff spec is empty");

  const segments = splitTopLevel(raw);
  const locked: ResolvedColor[] = [];
  const variances: VarianceSpec[] = [];
  let generatedCount: number | null = null;
  let versions: number | null = null;

  for (const segment of segments) {
    const s = segment.trim();
    if (!s) continue;

    const allVar = parseAllVariance(s);
    if (allVar) {
      variances.push(allVar);
      continue;
    }

    const colorVar = parseColorVariance(s);
    if (colorVar) {
      variances.push(colorVar);
      // ~blue(+10) also implies the colour is present as a lock base
      const base = resolveColorName(colorVar.name);
      if (!base) throw new Error(`Unknown colour in variance: "${colorVar.name}"`);
      if (!locked.some((c) => c.name === base.name)) locked.push(base);
      continue;
    }

    const plus = s.match(/^\+(\d+)$/);
    if (plus) {
      versions = Number.parseInt(plus[1], 10);
      continue;
    }

    if (/^\d+$/.test(s)) {
      const n = Number.parseInt(s, 10);
      if (generatedCount == null) generatedCount = n;
      else if (versions == null) versions = n;
      else throw new Error(`Unexpected extra integer "${s}" in riff spec`);
      continue;
    }

    // Locked colour name / phrase / hex / oklch
    const colors = resolveColorPhrase(s);
    for (const c of colors) {
      if (!locked.some((x) => x.name === c.name && x.hex === c.hex)) locked.push(c);
    }
  }

  // Defaults
  if (locked.length === 0 && variances.length === 0) {
    throw new Error("riff needs at least one locked colour or ~variance colour");
  }
  if (generatedCount == null) generatedCount = Math.max(0, 3 - locked.length);
  if (versions == null) versions = 1;

  if (generatedCount < 0) throw new Error("generated colour count must be >= 0");
  if (versions < 1) throw new Error("version count must be >= 1");
  if (locked.length + generatedCount > 12) {
    throw new Error("riff supports at most 12 colours per palette (locked + generated)");
  }

  return { locked, generatedCount, versions, variances, raw };
}

export function parseLockList(values: string[]): ResolvedColor[] {
  const out: ResolvedColor[] = [];
  for (const value of values) {
    for (const c of resolveColorPhrase(value)) {
      if (!out.some((x) => x.hex === c.hex)) out.push(c);
    }
  }
  return out;
}

function parseAllVariance(segment: string): AllVarianceSpec | null {
  const m = segment.match(/^~ALL\s*\((.+)\)\s*$/i);
  if (!m) return null;
  const inner = m[1].trim();
  // ~ALL(10) or ~ALL(-35,-20,-10) or ~ALL(-35, -20, -10)
  const parts = splitTopLevel(inner);
  const ranges: VarianceRange[] = [];
  for (const part of parts) {
    ranges.push(parseRangeToken(part.trim()));
  }
  if (ranges.length === 0) throw new Error("~ALL() needs at least one range");
  return { kind: "all", ranges };
}

function parseColorVariance(segment: string): ColorVarianceSpec | null {
  // ~name(range)  or  ~name(+10)  — name may contain spaces before '('
  const m = segment.match(/^~(.+?)\s*\((.+)\)\s*$/);
  if (!m) return null;
  const name = normalizeName(m[1]);
  if (name.toUpperCase() === "ALL") return null;
  return { kind: "color", name, range: parseRangeToken(m[2].trim()) };
}

/** Parse "10" | "+10" | "-23, +10" | "20" (symmetric) | "-35" */
function parseRangeToken(token: string): VarianceRange {
  const cleaned = token.replace(/\s+/g, "");
  // "-23,+10"
  const pair = cleaned.match(/^([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)$/);
  if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    // If both explicitly signed, treat as minus/plus magnitudes with signs
    if (pair[1].startsWith("-") || pair[2].startsWith("+") || pair[2].startsWith("-")) {
      const minus = Math.abs(Math.min(a, b, 0)) || (a < 0 ? Math.abs(a) : b < 0 ? Math.abs(b) : 0);
      const plus = Math.abs(Math.max(a, b, 0)) || (a > 0 ? a : b > 0 ? b : 0);
      // clearer: first is minus side if negative, second is plus if positive
      let m = 0;
      let p = 0;
      if (a <= 0 && b >= 0) {
        m = Math.abs(a);
        p = b;
      } else if (b <= 0 && a >= 0) {
        m = Math.abs(b);
        p = a;
      } else {
        m = Math.abs(a);
        p = Math.abs(b);
      }
      return { minus: m, plus: p };
    }
    return { minus: Math.abs(a), plus: Math.abs(b) };
  }
  const single = cleaned.match(/^([+-]?\d+(?:\.\d+)?)$/);
  if (!single) throw new Error(`Invalid variance range "${token}"`);
  const n = Number(single[1]);
  if (single[1].startsWith("+")) return { minus: 0, plus: Math.abs(n) };
  if (single[1].startsWith("-")) return { minus: Math.abs(n), plus: 0 };
  return { minus: Math.abs(n), plus: Math.abs(n) };
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}
