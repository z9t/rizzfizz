import type { PaletteRun, PaletteTokens } from "./types.js";

type Parser<T> = {
  parse(value: unknown): T;
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export const paletteTokensSchema: Parser<PaletteTokens> = {
  parse(value: unknown): PaletteTokens {
    const object = expectRecord(value, "palette tokens");
    return {
      paper: expectHex(object.paper, "tokens.paper"),
      panel: expectHex(object.panel, "tokens.panel"),
      ink: expectHex(object.ink, "tokens.ink"),
      muted: expectHex(object.muted, "tokens.muted"),
      accent: expectHex(object.accent, "tokens.accent"),
      accent_strong: expectHex(object.accent_strong, "tokens.accent_strong"),
      line: expectHex(object.line, "tokens.line")
    };
  }
};

export const paletteRunSchema: Parser<PaletteRun> = {
  parse(value: unknown): PaletteRun {
    const object = expectRecord(value, "palette run");
    if (object.schema !== "rizzfizz.palette-run.v1") {
      throw new Error("palette run schema must be rizzfizz.palette-run.v1");
    }
    const variants = expectArray(object.variants, "variants");
    if (variants.length === 0) throw new Error("variants must contain at least one item");
    return {
      schema: "rizzfizz.palette-run.v1",
      created_at: expectString(object.created_at, "created_at"),
      relationship: expectString(object.relationship, "relationship"),
      hue_family: expectString(object.hue_family, "hue_family"),
      source: expectString(object.source, "source"),
      variants: variants.map((variant, index) => {
        const item = expectRecord(variant, `variants[${index}]`);
        const relationship = expectRecord(item.palette_relationship, `variants[${index}].palette_relationship`);
        const checks = expectRecord(item.checks, `variants[${index}].checks`);
        return {
          id: expectString(item.id, `variants[${index}].id`),
          name: expectString(item.name, `variants[${index}].name`),
          strategy: expectString(item.strategy, `variants[${index}].strategy`),
          hue_family: expectString(item.hue_family, `variants[${index}].hue_family`),
          hue: expectNumber(item.hue, `variants[${index}].hue`),
          tokens: paletteTokensSchema.parse(item.tokens),
          palette_relationship: {
            tone: expectEnum(relationship.tone, ["dark", "light", "neutral"], `variants[${index}].palette_relationship.tone`),
            accent_usage: expectEnum(
              relationship.accent_usage,
              ["sparse", "moderate", "expressive"],
              `variants[${index}].palette_relationship.accent_usage`
            ),
            chroma: expectString(relationship.chroma, `variants[${index}].palette_relationship.chroma`),
            contrast: expectString(relationship.contrast, `variants[${index}].palette_relationship.contrast`),
            relationship: expectString(relationship.relationship, `variants[${index}].palette_relationship.relationship`)
          },
          palette_usage: expectString(item.palette_usage, `variants[${index}].palette_usage`),
          checks: {
            contrast: expectArray(checks.contrast, `variants[${index}].checks.contrast`).map((check, checkIndex) => {
              const contrast = expectRecord(check, `variants[${index}].checks.contrast[${checkIndex}]`);
              return {
                pair: expectString(contrast.pair, `variants[${index}].checks.contrast[${checkIndex}].pair`),
                foreground: expectHex(contrast.foreground, `variants[${index}].checks.contrast[${checkIndex}].foreground`),
                background: expectHex(contrast.background, `variants[${index}].checks.contrast[${checkIndex}].background`),
                ratio: expectNumber(contrast.ratio, `variants[${index}].checks.contrast[${checkIndex}].ratio`),
                level: expectEnum(contrast.level, ["pass", "warn", "fail"], `variants[${index}].checks.contrast[${checkIndex}].level`),
                threshold: expectNumber(contrast.threshold, `variants[${index}].checks.contrast[${checkIndex}].threshold`),
                required: expectBoolean(contrast.required, `variants[${index}].checks.contrast[${checkIndex}].required`)
              };
            }),
            warnings: expectArray(checks.warnings, `variants[${index}].checks.warnings`).map((item, warningIndex) =>
              expectString(item, `variants[${index}].checks.warnings[${warningIndex}]`)
            ),
            failures: expectArray(checks.failures, `variants[${index}].checks.failures`).map((item, failureIndex) =>
              expectString(item, `variants[${index}].checks.failures[${failureIndex}]`)
            )
          }
        };
      })
    };
  }
};

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`${label} must be a number`);
  return value;
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function expectHex(value: unknown, label: string): string {
  const string = expectString(value, label);
  if (!HEX_RE.test(string)) throw new Error(`${label} must be a #RRGGBB color`);
  return string;
}

function expectEnum<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const string = expectString(value, label);
  if (!allowed.includes(string)) throw new Error(`${label} must be one of ${allowed.join(", ")}`);
  return string;
}
