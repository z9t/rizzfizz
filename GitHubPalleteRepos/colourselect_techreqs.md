# Color Palette Generator — Technical Requirements & Recommendations

*Derived from analysis of 24 color palette repositories and resources. Last updated: May 2026.*

---

## Executive Summary

After analyzing 24 repositories that approach color palette generation from different angles, several clear patterns emerge. The most sophisticated implementations converge on **perceptually uniform color spaces** (OKLab/OKLCH/HSLuv), **mathematical interpolation with easing curves**, and **hybrid approaches** that combine algorithmic generation with human-curated quality guardrails. The field is bifurcating: simple tools use naive RGB/HSL manipulation, while advanced tools are adopting physics-based and perceptually rigorous methods.

---

## Most Effective Approaches Identified

### 1. Perceptually Uniform Color Space Operations (CRITICAL)

**Why it matters:** Operations in raw HSL/RGB produce visually uneven results. Equal steps in HSL lightness look dramatically different depending on hue (yellow appears lighter than blue at the same L value). Perceptually uniform spaces solve this.

**Evidence from codebase analysis:**
- `primer/prism` (GitHub's tool): Uses HSLuv exclusively — "step size N in lightness means roughly the same perceived brightness change regardless of hue"
- `lokesh/color-thief`: Defaults to OKLCH for quantization — "MMCQ splits align better with human perception"
- `ozwaldorf/lutgen-rs`: ALL interpolation methods operate in OKLab
- `tints.dev`: Offers "perceived" mode (HSLuv) as an alternative to "linear" mode (raw HSL)
- `spectral.js`: Uses OKLab/OKLCh after its spectral pipeline

**Recommendation:** Any new color palette generator should operate primarily in OKLCH or HSLuv. Raw HSL should only be offered as a legacy/performance option.

**Implementation priority:** REQUIRED

---

### 2. Curve-Based Interpolation with Independent Channel Control (HIGH)

**Why it matters:** Simple linear interpolation between colors produces mechanical, uninteresting results. Per-channel easing functions allow independent control of hue, saturation, and lightness transitions — enabling nuanced palette character.

**Evidence from codebase analysis:**
- `primer/prism`: Three independent curves (H, S, L) with 9 bezier easing families (linear, quadratic, cubic, quartic, quintic, sine, circular, exponential — each with in/out/inOut)
- `meodai/poline`: Per-axis independent position functions with 9 easing types — the most control of any surveyed tool
- `tints.dev`: Non-linear saturation formula `(diff+1)*s*(1+diff/10)` produces more natural saturation falloff than linear

**Recommendation:** Implement per-channel curve system with at minimum 4 easing functions (linear, ease-in, ease-out, ease-in-out). Allow curves to be defined independently for hue, chroma/saturation, and lightness.

**Implementation priority:** HIGH

---

### 3. Anchor-Based Palette Architecture (HIGH)

**Why it matters:** Instead of generating every color from a single base using fixed formulas, define strategic anchor colors and interpolate between them. This preserves human intent at key points while algorithmically filling the gaps.

**Evidence from codebase analysis:**
- `tints.dev`: Three-anchor lightness system — precise control over minimum lightness, base lightness, and maximum lightness
- `primer/prism`: Separate "base colors" (anchors) and "curves" (distribution patterns) — independently editable
- `meodai/poline`: Multi-segment paths between anchor points, with continuous sampling via `getColorAt(t)`
- `Refactoring UI`: Manual divide-and-conquer gap filling between darkest, base, and lightest (validates the anchor concept from a design perspective)

**Recommendation:** Design the generator with anchor-first architecture. User defines 3-5 anchor colors at strategic stops, generator interpolates between them. Allow per-anchor editing while preserving the interpolation model.

**Implementation priority:** HIGH

---

### 4. Multi-Mode Generation (MEDIUM)

**Why it matters:** Different use cases need different generation strategies. A UI design system needs a different approach than an artistic palette generator.

**Evidence from codebase analysis:**
- `tints.dev`: "Linear" (raw HSL) vs "Perceived" (HSLuv) modes
- `lutgen-rs`: 4 distinct interpolation methods (NearestNeighbor, RBF, GaussianSample, GaussianBlur) for different visual effects
- `Rickrack`: 7 harmony rules + 6 synchronization modes — users switch between them based on intent
- `Refactoring UI`: Categorical separation (greys vs primary vs accent) with different treatment per category

**Recommendation:** Support at minimum 3 generation modes:
1. **Scale mode** (like tints.dev): Generate a 10-13 step color scale from a base color — for UI design systems
2. **Harmony mode** (like Rickrack): Generate 3-7 color palettes using color harmony rules — for general design
3. **Freeform mode** (like poline): Curve-based palette journeys between anchor colors — for creative/artistic use

**Implementation priority:** MEDIUM

---

### 5. Palette Extraction from Images (MEDIUM)

**Why it matters:** Generating palettes from parameters is only half the story. Extracting palettes from reference images (photos, artwork, screenshots) is a common real-world workflow.

**Evidence from codebase analysis:**
- `lokesh/color-thief`: The most mature extraction library — MMCQ in OKLCH, swatch classification, WCAG contrast
- `99designs/colorific`: Two-pass approach (adaptive quantization + delta-E perceptual merge) produces cleaner results than single-pass MMCQ
- `ozwaldorf/lutgen-rs`: Uses `quantette` for image→palette extraction, then generates CLUT from extracted palette

**Recommendation:** Include image palette extraction as an input method. Using the two-pass approach from colorific (quantize → perceptually merge) produces cleaner results than single-pass MMCQ. Consider embedding this as an alternative to manual anchor definition.

**Implementation priority:** MEDIUM

---

## Recommended Technology Stack

### Color Science Libraries

| Library | Language | Why | Used By |
|---|---|---|---|
| **chroma-js** | JavaScript | Battle-tested, supports OKLCH/HSLuv, comprehensive API | palx, tints.dev |
| **culori** | JavaScript | Modern, tree-shakeable, full OKLab/LAB/DIN99o support, actively maintained | (newer alternative to chroma-js) |
| **colorjs.io** | JavaScript | Reference implementation of CSS Color Level 4/5, most accurate color math available | (W3C-linked, academically rigorous) |
| **colormath** | Python | CIELAB, delta-E formulas, wide gamut support | colorific |
| **oklab** (Rust crate) | Rust | Fast, minimal, OKLab-focused | lutgen-rs |
| **FastColor** | TypeScript | Ant Design's optimized color library, HSV-first | ant-design-colors |

**Recommendation:** For a new project, use **culori** (JS/TS) or **colorjs.io** (JS/TS) for the web, or implement OKLab/OKLCH conversions directly (the math is well-documented and small). For Python, use **colour-science** or implement the conversions — the OKLab transform is only ~30 lines of matrix math.

### Recommended Approach by Language

**Primary recommendation: TypeScript/JavaScript (web-first)**
- culori or colorjs.io for all color space operations
- OKLCH as the primary working color space
- Canvas/OffscreenCanvas for image palette extraction
- Web Worker for heavy computation (following lokesh/color-thief pattern)

**Alternative: Rust (performance/cross-platform)**
- `oklab` crate for color space conversions
- `kiddo` for KD-tree nearest-neighbor queries
- `rayon` for parallelism
- WASM target for web deployment (following lutgen-rs pattern)

**Alternative: Python (scientific/CLI)**
- numpy for vectorized color operations
- PIL/Pillow for image handling
- Custom OKLab/OKLCH implementation (matrix math, ~50 lines)

---

## Suggested Implementation Strategy

### Phase 1: Core Color Engine (1-2 weeks)

Build the color math foundation before any UI:

1. **Color space module:**
   - Implement sRGB ↔ Linear RGB ↔ OKLab ↔ OKLCh conversions
   - Validate with round-trip tests (all 256³ RGB values, like Rickrack's test suite)
   - Support hex, rgb(), hsl(), oklch() CSS string parsing and generation

2. **Interpolation module:**
   - Linear interpolation in OKLCh (handling hue wraparound correctly)
   - 4 easing functions: linear, ease-in, ease-out, ease-in-out (quadratic or cubic bezier)
   - Multi-stop interpolation along a path of anchor colors

3. **Scale generator:**
   - From a single base color, generate N-step scales with configurable:
     - Lightness anchors (min, base at index, max)
     - Chroma curve (how saturation changes across the scale)
     - Hue shift (proportional to distance from base)
   - Configurable stop count (e.g., Tailwind-style 10-step or 13-step)

### Phase 2: Harmony Engine (1 week)

1. **Harmony rules module:**
   - Complementary (hue ±180° with configurable spread)
   - Analogous (±15-45° spread)
   - Triadic (±120°)
   - Tetradic (±90°/±180°)
   - Monochromatic (same hue, varied chroma and lightness)
   - Golden ratio hue rotation (φ ≈ 222.5° — fills a gap NOT found in any surveyed repo)

2. **Variance control:**
   - Configurable randomness/jitter per rule
   - Saturation and lightness variation ranges
   - Lockable slots (user can pin specific colors)

### Phase 3: Image Extraction (1 week)

1. **Quantizer:**
   - MMCQ (from color-thief, well-understood algorithm)
   - OR two-pass approach (from colorific: adaptive quantize → perceptual merge)
   - Operate in OKLCh for perceptual alignment

2. **Swatch classification:**
   - Following lokesh/color-thief: classify into Vibrant/Muted/Dark/Light variants
   - Provide WCAG contrast ratios against each swatch

### Phase 4: UI & DX (2+ weeks)

1. **Interactive palette editor:**
   - Anchor-based: drag stops to adjust, see curves update live
   - Per-channel curve visualization (inspired by primer/prism's curve editor)
   - Real-time preview on sample UI components

2. **Export formats:**
   - CSS custom properties (Tailwind-compatible)
   - JSON (for programmatic use)
   - Design tool formats (Sketch palette, Figma JSON)

---

## Gaps & Opportunities

### 1. No Golden Ratio Palette Generator Exists
**Gap:** Despite the golden ratio (φ ≈ 1.618, angular equivalent ≈ 222.5°) being theoretically attractive for hue distribution (guarantees no two colors share the same hue and maximizes hue spread), NO surveyed repository implements it. All harmony generators use fixed intervals (30°, 60°, 90°, 120°).

**Opportunity:** Implement golden ratio hue rotation as a palette generation mode. For N colors: `hue_i = (hue_base + i * 222.5°) % 360`. This is known to produce maximally distinct, aesthetically pleasing hue distributions and is completely absent from the surveyed ecosystem.

### 2. Perceptual Uniformity Adoption is Still Partial
**Gap:** Only 4 of 24 repos use perceptually uniform color spaces (OKLab/OKLCH/HSLuv). The majority still operate in raw HSL or RGB. Even among the advanced repos, only lokesh/color-thief uses OKLCH as its DEFAULT color space.

**Opportunity:** A generator that uses OKLCH natively for ALL operations — interpolation, harmony rules, scale generation — would be ahead of 83% of the field. Most existing tools could be forked and improved simply by replacing their HSL math with OKLCh math.

### 3. No Tool Combines Extraction + Generation
**Gap:** Image extraction tools (color-thief, colorific) and palette generators (palx, tints.dev, poline) are entirely separate categories. No surveyed tool lets you extract a palette from an image AND refine it with harmony rules AND generate a design-system scale from it.

**Opportunity:** Build a pipeline: image → extract palette (MMCQ in OKLCh) → select one color as base → generate full scale (anchor-based interpolation) + harmony alternatives. This bridges the extraction/generation divide.

### 4. Accessibility Integration is Sparse
**Gap:** Only lokesh/color-thief and primer/prism include WCAG contrast checking. Most generators produce colors with no accessibility feedback.

**Opportunity:** Integrate WCAG 2.1 contrast ratio calculation into the generation pipeline. Warn when generated color combinations fail AA/AAA thresholds. Offer auto-correction: adjust lightness of failing colors while preserving hue.

### 5. No Dark/Light Theme Paired Generation
**Gap:** Only ant-design-colors generates dark theme variants (via optical mixing with dark background). No tool generates coordinated light + dark theme palettes as a pair.

**Opportunity:** Generate both light and dark variants simultaneously, maintaining perceptual consistency. Use the same hue/chroma curves but invert the lightness distribution.

### 6. Physics-Based Mixing is Underutilized
**Gap:** spectral.js is the ONLY tool using spectral-domain/Kubelka-Munk mixing. Every other tool mixes colors in a perceptual or device color space, producing physically unrealistic results (e.g., blue + yellow = gray instead of green).

**Opportunity:** For creative/artistic applications, spectral mixing produces more natural results. A spectral mixing mode for palette generation — even if computationally expensive — would be unique and valuable for artists. The GLSL shader from spectral.js could be adapted for real-time GPU-accelerated previews.

### 7. Design System Integration is Missing
**Gap:** Tools like tints.dev and ant-design-colors are close to design system tools but lack deep integration. primer/prism is GitHub-specific. No general-purpose tool exports directly to common design system formats (Figma tokens, Style Dictionary, Theo).

**Opportunity:** Export to W3C Design Tokens format (emerging standard). Generate complete token JSON with light/dark variants, semantic aliasing, and CSS custom property output.

---

## Quick-Start Implementation: Minimal Viable Color Engine

For someone wanting to build a color palette generator from this analysis, here's the minimal math needed:

```javascript
// OKLab/OKLCh conversion matrices (from Björn Ottosson, 2020)

// sRGB → Linear sRGB
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Linear sRGB → OKLab
function linearToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  };
}

// OKLab → OKLCh
function oklabToOklch(L, a, b) {
  return {
    L: L,
    C: Math.sqrt(a * a + b * b),
    h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360
  };
}

// Interpolate two OKLCh colors (handling hue wraparound)
function interpolateOklch(c1, c2, t) {
  let h1 = c1.h, h2 = c2.h;
  if (Math.abs(h2 - h1) > 180) {
    if (h1 < h2) h1 += 360; else h2 += 360;
  }
  return {
    L: c1.L + (c2.L - c1.L) * t,
    C: c1.C + (c2.C - c1.C) * t,
    h: (h1 + (h2 - h1) * t) % 360
  };
}
```

With just these foundations (~60 lines), you can build:
- A scale generator (interpolate between lightness anchors)
- A harmony generator (rotate hue by fixed angles in OKLCh)
- An easing curve system (apply easing to `t` before interpolation)

The hard part isn't the math — it's the UX of letting users express their intent. The surveyed repos succeed or fail primarily on how well they bridge algorithmic generation and human creative control.

---

## References

- Ottosson, B. (2020). "A perceptual color space for image processing." — OKLab/OKLCh specification
- Green, D.A. (2011). "A colour scheme for the display of astronomical intensity images." — Cubehelix algorithm
- Kubelka, P. & Munk, F. (1931). "Ein Beitrag zur Optik der Farbanstriche." — Kubelka-Munk theory
- CIE (1995). "Industrial Colour-Difference Evaluation." — CMC(l:c) and delta-E formulas
- Wathan, A. & Schoger, S. "Refactoring UI." — Manual palette methodology
