import assert from "node:assert/strict";
import test from "node:test";
import { buildPaletteRun, contrastRatio, easeInOut, interpolateOklch, oklchToHex, parseHexToOklch } from "../dist/color.js";

test("hex parsing round-trips through OKLCH and back to sRGB-safe hex", () => {
  const oklch = parseHexToOklch("#68b7ff");
  assert.equal(oklch.mode, "oklch");
  assert.match(oklchToHex(oklch), /^#[0-9A-F]{6}$/);
});

test("OKLCH interpolation handles hue wraparound", () => {
  const mid = interpolateOklch(
    { mode: "oklch", l: 0.5, c: 0.1, h: 350 },
    { mode: "oklch", l: 0.7, c: 0.2, h: 10 },
    0.5
  );
  assert.equal(Math.round(mid.h), 0);
});

test("ease-in-out has expected midpoint and non-linear first quarter", () => {
  assert.equal(easeInOut(0.5), 0.5);
  assert.ok(easeInOut(0.25) < 0.25);
});

test("WCAG contrast ratio catches high text contrast", () => {
  assert.ok(contrastRatio("#FFFFFF", "#000000") >= 21);
  assert.ok(contrastRatio("#777777", "#FFFFFF") < 4.5);
});

test("palette run includes required tokens and no required contrast failures", () => {
  const run = buildPaletteRun({ relationship: "dark-sparse-accent", hue: "blue", variants: 4, source: "test" });
  assert.equal(run.variants.length, 4);
  for (const variant of run.variants) {
    for (const key of ["paper", "panel", "ink", "muted", "accent", "accent_strong", "line"]) {
      assert.match(variant.tokens[key], /^#[0-9A-F]{6}$/);
    }
    assert.deepEqual(variant.checks.failures, []);
  }
});
