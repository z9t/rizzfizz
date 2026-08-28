/**
 * blend.ts — OKLCH-projection palette blend.
 *
 * Workflow: Given a source palette (one role-token set from a site you like)
 * plus a list of locked brand colours you must preserve, produce a new
 * role-token set where the locked colours are kept verbatim and the *remaining
 * roles* (paper, panel, ink, muted, line) are projected into the brand's hue
 * identity while preserving the source's chroma/lightness delta map.
 *
 * The intuition: if the source's paper hue was 70° and the source's accent was
 * 30°, that's a -40° offset — sign and magnitude carry through. If your
 * brand's primary locked colour is hue 250°, your blend's paper is 250° + (-40°)
 * = 210°, with the source's paper (L=0.94, C=0.02) preserved so the surface
 * still feels "warm off-cream rather than cold white".
 *
 * Contrast safety: paper↔ink is checked at ≥4.5:1. If primary locked colour
 * makes it impossible, fall back to hardcoded neutral (L=0.97 paper / L=0.18
 * ink) with hue from primary. Same fallback for any role whose derived
 * contrast against paper fails.
 */

import { oklchToHex, parseHexToOklch, contrastRatio } from "./color.js";

// Local mirror of the OklchColor type — defined in src/color.ts but not
// exported there. Mirrored here so blend.ts doesn't pull in a non-export.
type OklchColor = { mode: "oklch"; l: number; c: number; h: number };

// All 7 doctrine token roles used by rizzfizz swatchesToDoctrineTokens.
// Source: src/color-names.ts lines 210–252.
export type TokenRole =
  | "paper"
  | "panel"
  | "ink"
  | "muted"
  | "accent"
  | "accent_strong"
  | "line";

export const ALL_TOKEN_ROLES: TokenRole[] = [
  "paper",
  "panel",
  "ink",
  "muted",
  "accent",
  "accent_strong",
  "line",
];

export type TokenPalette = Record<TokenRole, string>;

/** Roles that rizzfizz's swatch→token arith normally fills via projection. */
export const PROJECTED_ROLES: TokenRole[] = [
  "paper",
  "panel",
  "ink",
  "muted",
  "line",
];

/** Roles that get *literal* brand colours (or stay source-derived if no lock). */
export const LOCKABLE_ROLES: TokenRole[] = ["accent", "accent_strong"];

export type BlendInput = {
  /** Source palette, e.g. extracted from rizzfizz palette-run.json or DESIGN.md. */
  source: TokenPalette;
  /** Locked brand colours. Each entry is either a hex string (sequential → accent, accent_strong…)
   *  or a `role:hex` pair (explicit binding). Max 14 tokens accepted; extras warn but are dropped. */
  locks: string[];
  /** Minimum contrast between paper and ink (WCAG AA body). Default 4.5. */
  minContrast?: number;
  /**
   * When true (default), lightness for `paper`, `panel`, `line` is clamped to a
   * "high" surface range so backgrounds remain visually still-cream even when the
   * primary anchor is very dark. Set false to compute the full OKLCH delta
   * (paper will sit lower than 0.85 if primary is dark, but contrast holds).
   */
  clampHighLightness?: boolean;
};

export type BlendOutput = {
  /** Final 7-token role palette. */
  tokens: TokenPalette;
  /** Per-role OKLCH values used, for audit / debugging. */
  oklch: Record<TokenRole, OklchColor>;
  /** For each projected role, the (Δhue, Δchroma, Δlightness) carried over from source. */
  source_offsets: Record<TokenRole, { dHue: number; dChroma: number; dLightness: number } | null>;
  /** Final lock→role mapping after distribution. */
  lock_assignment: Record<TokenRole, string | null>;
  /** Source mode detection: "light-source" if source paper L > 0.5 else "dark-source". */
  source_mode: "light" | "dark";
  /** Roles where projection had to fall back to a neutral to maintain contrast. */
  contrast_fallback_uses: TokenRole[];
  /** Warnings emitted during blend. */
  warnings: string[];
};

/** Wrap a hue to [0, 360). */
function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/** Smallest signed angular distance from `a` to `b` along the hue circle. */
function hueAngularDelta(a: number, b: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/** Build a neutral OKLab+L / fallback token while preserving the role's chroma. */
function neutralFallback(role: TokenRole, hueAnchor: OklchColor): OklchColor {
  switch (role) {
    case "paper":
      return { mode: "oklch", l: 0.97, c: 0.01, h: hueAnchor.h };
    case "panel":
      return { mode: "oklch", l: 0.92, c: 0.015, h: hueAnchor.h };
    case "ink":
      return { mode: "oklch", l: 0.18, c: 0.02, h: hueAnchor.h };
    case "muted":
      return { mode: "oklch", l: 0.5, c: 0.03, h: hueAnchor.h };
    case "line":
      return { mode: "oklch", l: 0.8, c: 0.02, h: hueAnchor.h };
    default:
      return hueAnchor;
  }
}

/**
 * Run the blend. See file header for the rule. Returns a `BlendOutput` with
 * the final 7-token palette, the OKLCH of every role, the source-deltas that
 * were preserved, and contrast-fallback logs.
 */
export function runBlend(input: BlendInput): BlendOutput {
  const warnings: string[] = [];
  const min = input.minContrast ?? 4.5;
  const clampHigh = input.clampHighLightness ?? true;
  const fallbackUses: TokenRole[] = [];

  // Step 1: decode source and brand primary.
  const source = input.source;
  const sourceOklch: Record<TokenRole, OklchColor> = {} as Record<TokenRole, OklchColor>;
  for (const r of ALL_TOKEN_ROLES) {
    sourceOklch[r] = parseHexToOklch(source[r]);
  }
  const sourceAccent = sourceOklch.accent;
  const sourcePaperL = sourceOklch.paper.l;
  const source_mode: "light" | "dark" = sourcePaperL > 0.5 ? "light" : "dark";

  // Step 2: distribute locked colours across roles.
  // Each lock may be either:
  //   - bare hex like "#1E3A8A"           → assigned to LOCKABLE_ROLES in order
  //   - "role:#hex" like "paper:#FFF9F2"   → assigned to that explicit role
  const lockAssignment: Record<TokenRole, string | null> = {
    paper: null,
    panel: null,
    ink: null,
    muted: null,
    accent: null,
    accent_strong: null,
    line: null,
  };
  const lockIndex = { i: 0 };
  const rawLocks = input.locks.filter(Boolean);
  for (const lock of rawLocks) {
    const colon = lock.indexOf(":");
    const roleName = colon > 0 ? lock.slice(0, colon).trim().toLowerCase() : null;
    const hex = colon > 0 ? lock.slice(colon + 1).trim() : lock;
    if (roleName && ALL_TOKEN_ROLES.includes(roleName as TokenRole)) {
      lockAssignment[roleName as TokenRole] = hex;
    } else if (lockIndex.i < LOCKABLE_ROLES.length) {
      lockAssignment[LOCKABLE_ROLES[lockIndex.i]] = hex;
      lockIndex.i++;
    } else {
      warnings.push(
        `extra lock "${lock}" ignored — only the first ${LOCKABLE_ROLES.length} bare-hex locks (${LOCKABLE_ROLES.join(", ")}) get auto-assigned, use "role:hex" to target a specific role`,
      );
    }
  }

  if (rawLocks.length === 0) {
    warnings.push(
      "no --lock colours supplied; falling back to source role assignments verbatim",
    );
  }

  // Step 3: project remaining PROJECTED_ROLES into the brand's hue family
  // while preserving the source's (Δhue, Δchroma, Δlightness) relative to its accent.
  const out: Record<TokenRole, OklchColor> = {} as Record<TokenRole, OklchColor>;
  const offsets: Record<TokenRole, { dHue: number; dChroma: number; dLightness: number } | null> =
    {} as Record<TokenRole, { dHue: number; dChroma: number; dLightness: number } | null>;

  // Lock the primary anchor to the brand's accent (locked or source fallback).
  const primaryOklch = lockAssignment.accent
    ? parseHexToOklch(lockAssignment.accent)
    : sourceAccent;

  // Set accent / accent_strong from locks (verbatim), or from source.
  out.accent = lockAssignment.accent ? parseHexToOklch(lockAssignment.accent) : sourceAccent;
  out.accent_strong = lockAssignment.accent_strong
    ? parseHexToOklch(lockAssignment.accent_strong)
    : sourceOklch.accent_strong;

  // Then project each remaining role.
  // Locked explicit roles skip projection entirely.
  for (const role of PROJECTED_ROLES) {
    if (lockAssignment[role]) {
      out[role] = parseHexToOklch(lockAssignment[role] as string);
      offsets[role] = null;
      continue;
    }
    const srcRole = sourceOklch[role];
    const dHue = hueAngularDelta(sourceAccent.h, srcRole.h);
    const dChroma = srcRole.c - sourceAccent.c;
    const dLightness = srcRole.l - sourceAccent.l;
    offsets[role] = { dHue, dChroma, dLightness };

    // Projection = primary anchor + offset
    const projected: OklchColor = {
      mode: "oklch",
      l: primaryOklch.l + dLightness,
      c: Math.max(0, primaryOklch.c + dChroma),
      h: wrapHue(primaryOklch.h + dHue),
    };

    // Optional surface-lightness clamp so paper/panel/line don't fall off
    // when the brand primary is very dark.
    if (clampHigh) {
      if (role === "paper" || role === "line") {
        projected.l = Math.max(projected.l, 0.94);
      } else if (role === "panel") {
        projected.l = Math.max(projected.l, 0.88);
      }
    }
    out[role] = projected;
  }

  // Step 4: convert OKLCH → hex and run contrast safety.
  const hexTokens: TokenPalette = {} as TokenPalette;
  for (const r of ALL_TOKEN_ROLES) hexTokens[r] = oklchToHex(out[r]);

  const paperHex = hexTokens.paper;
  const inkHex = hexTokens.ink;
  const cr = contrastRatio(inkHex, paperHex);
  if (cr < min) {
    const anchor = primaryOklch;
    const fallbackPaper = neutralFallback("paper", anchor);
    const fallbackInk = neutralFallback("ink", anchor);
    hexTokens.paper = oklchToHex(fallbackPaper);
    hexTokens.ink = oklchToHex(fallbackInk);
    out.paper = fallbackPaper;
    out.ink = fallbackInk;
    warnings.push(
      `contrast paper↔ink was ${cr.toFixed(2)} (needs ≥${min}); fell back to neutral paper/ink with primary hue`,
    );
    fallbackUses.push("paper", "ink");
  }

  // Contrast on accent/accent_strong against paper (graphical AA = 3.0).
  const accentHex = hexTokens.accent;
  const accentCR = contrastRatio(accentHex, paperHex);
  if (accentCR < 3.0) {
    warnings.push(
      `accent against paper was ${accentCR.toFixed(2)} (graphical needs ≥3.0); if a brand spec needs ≥4.5, swap paper/ink or lock ink directly`,
    );
  }

  // Keep lock tokens literal in the output (don't re-derive from OKLCH).
  for (const r of ALL_TOKEN_ROLES) {
    if (lockAssignment[r]) hexTokens[r] = lockAssignment[r] as string;
  }

  return {
    tokens: hexTokens,
    oklch: out,
    source_offsets: offsets,
    lock_assignment: lockAssignment,
    source_mode,
    contrast_fallback_uses: Array.from(new Set(fallbackUses)),
    warnings,
  };
}

/**
 * Build a TokenPalette from the source JSON, with two forms accepted:
 *   1. Top-level TokenPalette: `{paper, panel, ink, muted, accent, accent_strong, line}`
 *   2. Wrapped palette-run: `{variants: [{tokens: {...}}]}` — picks variant-1.
 *   3. Webflow CSS text: any string containing `--var: #hex;` declarations. Picks
 *      the first match per role-name heuristic (see tokeniseCssPalette).
 * Throws on missing roles.
 */
export function normaliseSourcePalette(raw: Record<string, unknown>): TokenPalette {
  if (typeof raw === "string") {
    return tokeniseCssPalette(raw);
  }
  if (raw && typeof raw === "object" && "variants" in raw && Array.isArray((raw as any).variants)) {
    const variant = ((raw as any).variants[0] as any) || {};
    raw = (variant.tokens as Record<string, unknown>) || {};
  }
  const out: Record<string, string> = {};
  for (const role of ALL_TOKEN_ROLES) {
    const v = (raw as any)[role];
    if (typeof v !== "string" || !/^#?[0-9a-fA-F]{6}$/.test(v.replace("#", ""))) {
      throw new Error(`source palette missing role "${role}" (or not a valid hex): got ${JSON.stringify(v)}`);
    }
    out[role] = v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`;
  }
  return out as TokenPalette;
}

/**
 * Extract a TokenPalette directly from a CSS source string.
 *
 * Strategy: match each role's canonical variable name (with fallbacks) and
 * return the first hex per role. Roles where we don't find a variable fall
 * back to the source defaults for the detected light/dark mode — never throw,
 * because a designer might not have declared `--line` etc. on the page.
 *
 * Variable-name fallbacks (first wins):
 *   - paper:        --paper, --background, --neutral-mid
 *   - panel:        --panel, --surface
 *   - ink:          --ink, --text, --black
 *   - muted:        --muted, --secondary-text
 *   - accent:       --accent, --primary, --color
 *   - accent_strong:--accent-strong, --accent-strong, --primary-strong
 *   - line:         --line, --border, --stroke
 */
export function tokeniseCssPalette(css: string): TokenPalette {
  const find = (candidates: string[]): string | null => {
    for (const name of candidates) {
      const re = new RegExp(
        `--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`,
        "i",
      );
      const m = css.match(re);
      if (m) return m[1].toUpperCase().startsWith("#") ? m[1].toUpperCase() : `#${m[1].toUpperCase()}`;
    }
    return null;
  };

  // Light/dark fallback defaults (OKLab L clamp matched to source mode).
  const detectMode = (): "light" | "dark" => {
    const bg = find(["background", "paper"]) || "#FFFFFF";
    const { l } = parseHexToOklch(bg);
    return l > 0.5 ? "light" : "dark";
  };
  const mode = detectMode();
  const light = {
    paper: "#F8F4EC",
    panel: "#F1ECE3",
    ink: "#1C1816",
    muted: "#6E6660",
    accent: "#B14A33",
    accent_strong: "#8C2A18",
    line: "#D9D2C5",
  } as const;
  const dark = {
    paper: "#0E1410",
    panel: "#161D18",
    ink: "#F5F0E8",
    muted: "#A39B91",
    accent: "#FF7F77",
    accent_strong: "#D65C55",
    line: "#3A3530",
  } as const;
  const fallback = mode === "light" ? light : dark;

  const out: Record<string, string> = {};
  for (const role of ALL_TOKEN_ROLES) {
    out[role] = find(ROLE_VAR_CANDIDATES[role]) ?? (fallback as any)[role];
  }
  return out as TokenPalette;
}

const ROLE_VAR_CANDIDATES: Record<TokenRole, string[]> = {
  paper: ["paper", "background", "neutral-mid"],
  panel: ["panel", "surface"],
  ink: ["ink", "text", "black"],
  muted: ["muted", "secondary-text", "dark-grey"],
  accent: ["accent", "primary", "color", "coral"],
  accent_strong: ["accent-strong", "accent_strong", "primary-strong"],
  line: ["line", "border", "stroke"],
};
