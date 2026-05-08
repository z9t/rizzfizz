# Color Palette Generator & Selector — Comprehensive Approaches Report

Generated from analysis of 24 repositories and resources listed in `GithubPaletteGenSearch.txt`. Every entry was cloned and its source code examined for actual algorithm implementations, color space usage, and mathematical foundations.

---

## Part 1: Per-Repository Analysis

---

### Image-Based Palette Extraction

These repositories extract dominant color palettes from images rather than generating palettes from parameters.

---

## fengsp/color-thief-py

**Repository URL:** https://github.com/fengsp/color-thief-py
**Primary Approach:** Image extraction — MMCQ (Modified Median Cut Quantization)

### Color Theory/Math Used
- **MMCQ algorithm** ported from Leptonica C library:
  - Color space reduction: each 8-bit RGB channel right-shifted by 3 bits (SIGBITS=5) → 32,768 possible quantized colors
  - `index = (r << (2*SIGBITS)) + (g << SIGBITS) + b`
  - VBox volume: `(r2 - r1 + 1) * (g2 - g1 + 1) * (b2 - b1 + 1)`
  - VBox average: `r_avg = Σ(hval * (i + 0.5) * mult) / ntot` where `mult = 1 << (8 - SIGBITS) = 8`
  - Median cut split: find point `i` where `partialsum[i] > total/2`, split along longest dimension (max of rw, gw, bw)
  - Split point adjustment with centering bias
  - Two-phase sorting: Phase 1 by population (targets FRACT_BY_POPULATIONS=0.75 of max_colors), Phase 2 by `count*volume`
- Nearest color: Euclidean distance `√((r1−r2)² + (g1−g2)² + (b1−b2)²)`

### Technology Stack
- Pure Python, single-file (422 lines in `colorthief.py`)
- Dependency: Pillow (PIL)
- Python 2.7+/3.x

### Key Implementation Details
- Quality parameter: samples every Nth pixel (quality=10 → 1/10th of pixels)
- Filters: alpha < 125 (transparent), all r,g,b > 250 (near-white)
- Lazy-sorted priority queue (PQueue) sorts only on peek/pop
- Iterative splitting until target color count or MAX_ITERATION=1000
- `get_color()` returns dominant color; `get_palette(count, quality)` returns full palette

### Common With
lokesh/color-thief (JS), 99designs/colorific (shared image extraction category)

---

## lokesh/color-thief

**Repository URL:** https://github.com/lokesh/color-thief
**Primary Approach:** Image extraction — MMCQ with OKLCH color space (default)

### Color Theory/Math Used
- Same MMCQ core (5-bit reduction, VBox splitting, two-phase sorting)
- **OKLCH color space path (DEFAULT)**: Perceptually uniform quantization
  - sRGB → linear: `linear(c) = c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`
  - Linear sRGB → LMS (Oklab M1 matrix): `l_ = 0.4122214708·lr + 0.5363325363·lg + 0.0514459929·lb`; `m_ = 0.2119034982·lr + 0.6806995451·lg + 0.1073969566·lb`; `s_ = 0.0883024619·lr + 0.2817188376·lg + 0.6299787005·lb`
  - LMS → OKLab: cube root each channel, matrix multiply
  - OKLab → OKLCH: `C = √(a²+b²)`, `H = atan2(b,a)` in degrees
  - Scale L(0-1)→0-255, C(0-0.4)→0-255, H(0-360)→0-255 for MMCQ
  - Post-quantization: unscale → OKLab → LMS → linear sRGB → sRGB
- WCAG contrast: `L = 0.2126·linear(R) + 0.7152·linear(G) + 0.0722·linear(B)`; ratio = `(L_lighter + 0.05) / (L_darker + 0.05)`

### Technology Stack
- TypeScript, Node.js + Browser
- Build: tsup, no external runtime dependencies
- Optional WASM quantizer for performance
- Platform adapters: Canvas/ImageData/Video (Browser), Jimp/sharp (Node)

### Key Implementation Details
- OKLCH is DEFAULT — provides perceptually uniform quantization, so MMCQ splits align with human perception
- Pluggable quantizer: `MmcqQuantizer` (pure TS) or `WasmQuantizer`
- Progressive extraction: yields intermediate palettes at increasing quality passes
- Swatch classification: Vibrant/Muted/DarkVibrant/DarkMuted/LightVibrant/LightMuted roles
- Web Worker support, AbortSignal support throughout
- Rich Color object: hex, rgb, hsl, oklch, css(), textColor, isDark/isLight, WCAG contrast

### Common With
fengsp/color-thief-py (shared MMCQ heritage but diverged significantly — this version innovates with OKLCH)

---

## 99designs/colorific

**Repository URL:** https://github.com/99designs/colorific
**Primary Approach:** Image extraction — Adaptive quantization + delta-E CMC perceptual merging

### Color Theory/Math Used
- **Pass 1:** PIL's built-in adaptive palette quantization (`im.convert('P', palette=Image.ADAPTIVE, colors=N_QUANTIZED=100)`) — median-cut-based internal PIL algorithm
- **Pass 2:** Perceptual color aggregation using **delta-E CMC** in CIELAB space
  - `delta_e_cmc` with CMC(l:c) weighting (2:1 — standard acceptability weighting)
  - Merge threshold: `MIN_DISTANCE = 10.0`
  - Conversion pipeline: sRGB → XYZ (D65) → CIELAB via `colormath` library
- Background detection: 8-point edge sampling (corners + midpoints), must appear ≥3 times
- HSV saturation filter: `colorsys.rgb_to_hsv(r/255, g/255, b/255)[1] > MIN_SATURATION = 0.05`
- Prominence filter: `prominence = count / total_pixels`; keep if ≥ `colors[0].prominence * MIN_PROMINENCE = 0.01`
- Autocrop: `ImageChops.difference(im, white_bg) → getbbox()` removes white borders

### Technology Stack
- Python 2.7/3.x
- Dependencies: Pillow, colormath, colorsys (stdlib), multiprocessing (stdlib)
- unittest-based testing

### Key Implementation Details
- Two-pass approach is unique: PIL quantization reduces to 100 colors, then delta-E merges visually similar ones
- Delta-E CMC is perceptually uniform — merging decisions align with human color difference perception
- `@lru_cache` on `convert_sRGB()` avoids repeated CIELAB conversions
- Multiprocessing: N_PROCESSES workers with shared Queue for batch image processing
- Output: tab-separated with filename, hex_colors (comma-separated), bgcolor_hex
- MAX_COLORS=5 ensures focused palettes for design use

### Common With
color-thief (image extraction family), DingMouRen/PaletteImageView (extraction from images)

---

## mrousavy/Colorwaver

**Repository URL:** https://github.com/mrousavy/Colorwaver
**Primary Approach:** Camera-based extraction — delegated to native platform libraries

### Color Theory/Math Used
- **Does NOT implement its own color algorithm** — thin wrapper delegating to:
  - **Android:** AndroidX Palette library (internal: HSL histogram quantization, candidate scoring against 6 target profiles — Vibrant, LightVibrant, DarkVibrant, Muted, LightMuted, DarkMuted — using weighted saturation/lightness/population)
  - **iOS:** UIImageColors library (Swift port of Panic's palette extraction — k-means-like iterative refinement)
- YUV→RGB conversion: RenderScript `ScriptIntrinsicYuvToRGB` (GPU-accelerated, Android)
- Color transitions: `interpolateColor(animation_value, [0,1], [fromColor, toColor])` via React Native Reanimated

### Technology Stack
- React Native (TypeScript app layer), Java+Kotlin (Android native), Swift+ObjC (iOS native)
- react-native-vision-camera (frame processing), react-native-reanimated
- androidx.palette:palette, UIImageColors (Swift package)

### Key Implementation Details
- Quality levels: 'lowest' (50px), 'low' (100px), 'high' (250px), 'highest' (full frame)
- Result format: `{primary, secondary, background, detail}` as hex strings
- YuvToRgbConverter noted as "NOT production-ready" (multiple copies per frame)
- This is a **consumer** of palette algorithms, not a provider

### Common With
fengsp/color-thief-py, lokesh/color-thief, 99designs/colorific (image extraction category), but delegates to native libraries rather than implementing algorithms

---

### Harmony & Rule-Based Palette Generators

These repositories generate color palettes using explicit color harmony rules (complementary, analogous, triadic, etc.).

---

## eigenmiao/Rickrack

**Repository URL:** https://github.com/eigenmiao/Rickrack
**Primary Approach:** Harmony-based — comprehensive color theory engine with 7 harmony rules + 6 synchronization modes

### Color Theory/Math Used
- **Primary color space:** HSV with full hand-implemented RGB↔HSV↔LAB↔CMYK conversions (vectorized via numpy)
- **RYB color space** (artist's color wheel): custom piecewise-linear RGB↔RYB hue mapping
  - RGB hue [0,60) → RYB [0,120); RGB [60,240) → RYB [120,240); otherwise identity
  - When RYB mode active: all harmony calculations done in RYB space for artist-accurate relationships
- LAB formulas: standard sRGB→XYZ→LAB pipeline (γ≈2.4, D65 white point, cube-root/slope at 0.008856)
- CMYK formulas: `K = min(1-R,1-G,1-B)`; `C,M,Y = (1-R-K, 1-G-K, 1-B-K)/(1-K)`
- HSV-based 10-category color naming scheme (sign method): 9 hue sectors × 4 S × 4 V quadrants

### Harmony Rules (7 + Custom):
- **Analogous:** ±angle, ±2×angle (clamped to ±30° max from existing spread)
- **Monochromatic:** Same H, S/V varied in 2×2 grid pattern
- **Triad:** ±120° hue offsets
- **Tetrad:** ±90°, ±180° offsets with even/odd slot pairing
- **Pentad:** ±72°, ±144° offsets
- **Complementary:** H+180° pairing + monochromatic-style S/V variation
- **Shades:** 5-step V ramp at fixed [base.V, 0.15, 0.40, 0.65, 0.90]

### Synchronization Modes (6):
- **Unlimited:** No S/V sync
- **H Locked:** Hue changes propagate, S/V independent
- **S Locked:** Only H propagates, S/V stay fixed
- **Equidistant:** H, S, V deltas all propagate
- **Equal:** All slots set to same S/V as modified slot
- **Gradual:** S/V linearly interpolated between slots
- **Symmetrical:** S/V mirrored: slots 1↔3 and 2↔4 kept symmetrical

### Technology Stack
- Python 3.5+, PyQt5 (GUI), numpy, Pillow
- 3-layer architecture: ricore/ (core engine, no GUI), wgets/ (Qt widgets), cguis/ (UI forms)
- Standalone `rickrack/` Python module for headless/programmatic use
- Server mode for programmatic access
- 1154-line Color class, 686-line ColorSet class, 20+ language translations

### Key Implementation Details
- Comprehensive test suite: 256³ RGB round-trip tests for all color space conversions
- Color board generator via weighted interpolation from palette colors onto customizable grid
- Production-grade — the most sophisticated harmony-based generator in this survey
- RYB support makes it unique: harmony rules follow artist's color wheel, not RGB/CMY wheel

### Common With
jcrispinroundtree/ColorPaletteRandomizer, brettalford/Color-Palette-Generator (harmony rule approach, but Rickrack is far more sophisticated)

---

## jcrispinroundtree/ColorPaletteRandomizer

**Repository URL:** https://github.com/jcrispinroundtree/ColorPaletteRandomizer
**Primary Approach:** Harmony-based — 4 standard rules via Java HSB

### Color Theory/Math Used
- **Color space:** HSB via `java.awt.Color.RGBtoHSB()` (no custom conversion logic)
- **Monochromatic:** Same H. Slot 1: S×0.7 V×1.3; Slot 2: S×1.3 V×0.7; Slot 3: S×0.7 V×0.7; Slot 4: V×0.2
- **Analogous:** 5 hues at -30°, -15°, 0°, +15°, +30° (fixed ±2/12 intervals)
- **Complementary:** Base hue variations (S×0.7, V×0.7 etc.) + H+180° at S×0.5, V×1.4
- **Triadic:** Slots at +120° and +240° with S/V variations

### Technology Stack
- Java, Swing GUI (javax.swing, java.awt)
- Standard library only, no external dependencies
- Single file: 222 lines

### Key Implementation Details
- Fixed formulas — no user-adjustable parameters (unlike Rickrack)
- Bug: Complementary slot 4 assigned twice (lines 147-148), second assignment overwrites first
- Enum `PaletteType` for rule dispatch
- Color-lock toggle to preserve base color across generations

### Common With
eigenmiao/Rickrack, brettalford/Color-Palette-Generator (harmony rule approach), Korben-Coffman/Palette-Generator (school-project tier)

---

## Korben-Coffman/Palette-Generator

**Repository URL:** https://github.com/Korben-Coffman/Palette-Generator
**Primary Approach:** Pseudo-harmony — raw RGB channel manipulation (NO color theory)

### Color Theory/Math Used
- **Color space:** Raw RGB only — NO HSV/HSL/LAB
- **Base color:** One channel [200,255], others [50,200], channels shuffled randomly
- **Shades:** Subtract random value between 1/3 and 1/2 of min channel from all channels
- **"Complementary":** `complimentary_color[i] = 255 - palette_color[i]` — mathematical RGB negation, NOT hue-based complement

### Technology Stack
- Python 3, tkinter (built-in)
- Standard library only
- Single file: 111 lines

### Key Implementation Details
- Produces 6 colors: base + 2 shades + 3 inverted "complements"
- RGB channel-wise negation is NOT perceptually complementary (works accidentally for pure red/cyan, yellow/blue, but fails for intermediate colors)
- tkinter Canvas renders color swatches
- Simplest approach in the entire survey — no color theory foundation

### Common With
henngelm/background-generator-javascript, MichaelRendon/Background-Generator (no actual color theory, simple random/manual RGB)

---

## brettalford/Color-Palette-Generator

**Repository URL:** https://github.com/brettalford/Color-Palette-Generator
**Primary Approach:** Harmony-based — HSL harmony rules with proper hand-implemented conversions

### Color Theory/Math Used
- **Color space:** HSL with hand-implemented rgb↔hsl conversion (standard hexcone formulas, correctly done)
- RGB→HSL: `L = (max+min)/2`; `S = L>0.5 ? (max-min)/(2-max-min) : (max-min)/(max+min)`; H from which channel is max using standard 6-sector formula
- HSL→RGB: `hue2rgb` helper with piecewise linear interpolation over 6 sectors
- **Complementary:** `H = (H + 180) % 360` + ±18° jitter
- **Analogous:** ±30° or -25° shift (randomly chosen) + ±18° jitter; effective range ~5°-48°
- **"Clashing" (Opposing):** RGB channel rotation `[R,G,B] → [G,B,R]` + ±5% random offset per channel — nonstandard, no hue/wheel basis

### Technology Stack
- Vanilla HTML/CSS/JS, no frameworks
- Deployed via GitHub Pages
- Main file: scripts.js (372 lines)

### Key Implementation Details
- 5-color slots with lock toggle (prevents overwrite) and star toggle (marks reference for harmony)
- Editable hex codes — typing updates swatch
- Star button auto-locks the starred slot
- Good UX for a student project
- Bug: complementary rule fills ALL unlocked slots with same derived color rather than varied colors

### Common With
eigenmiao/Rickrack, jcrispinroundtree/ColorPaletteRandomizer (harmony rule approach with proper HSL/HSB space)

---

### Algorithmic & Curve-Based Palette Generators

These repositories use mathematical approaches — interpolation, easing curves, step functions — to generate palettes from base colors.

---

## jxnblk/palx

**Repository URL:** https://github.com/jxnblk/palx
**Primary Approach:** Algorithmic — hue rotation + luminance stepping

### Color Theory/Math Used
- **Color space:** HSL via chroma-js
- **Hue step:** `360 / 12 = 30°` — 12 equidistant hue variations
- **Hue formula:** `hue_i = (base_hue + i * 30) % 360` for i = 0..11
- **Luminance levels:** `[9,8,...,0].map(n => (n + 0.5)/10)` → `[0.95, 0.85, ..., 0.05]`
- **Desaturation for gray/black:** `1/8 (0.125)` of base saturation
- **Hue naming:** `Math.round((hue - 2) / 30)` maps to 12-name color wheel

### Technology Stack
- JavaScript, dependency: chroma-js
- Simple library: takes one hex, returns full palette object

### Key Implementation Details
- Elegantly simple: one base color → full UI palette (12 hues × 10 shades + black + gray = 122 colors)
- Luminance stepping creates perceptually even lightness gradations
- Named hues (red, orange, yellow, lime, green, teal, cyan, blue, indigo, violet, fuchsia, pink)

### Common With
ant-design/ant-design-colors (fixed-step HSL/HSV manipulation), tints.dev (hue rotation + luminance stepping)

---

## ant-design/ant-design-colors

**Repository URL:** https://github.com/ant-design/ant-design-colors
**Primary Approach:** Algorithmic — fixed-step HSV with directional hue rotation

### Color Theory/Math Used
- **Color space:** HSV via `@ant-design/fast-color`
- **Hue step:** 2° per step
- **Directional hue rotation:** If hue in [60°, 240°] (green-cyan-blue range), rotate HUE DOWNWARD for lighter, UPWARD for darker. Warm colors (red-yellow) rotate the opposite direction. This recognizes that cooler hues need different rotation direction to stay visually harmonious.
- **Lighter colors (5 steps):** `S_new = S - 0.16×i`; `V_new = V + 0.05×i`
- **Darker colors (4 steps):** `S_new = S + 0.05×i` (final step: +0.16); `V_new = V - 0.15×i`
- **Saturation clamp:** [0.06, 1.0], first lighter step limited to 0.1
- **Dark theme:** Optical mixing of each color with dark background (#141414) at [15, 25, 30, 45, 65, 85, 90, 95, 97, 98]% pattern percentages

### Technology Stack
- TypeScript, `@ant-design/fast-color`
- Library-only (used by Ant Design design system)

### Key Implementation Details
- Exactly 10 colors: 5 lighter + base + 4 darker
- Asymmetric saturation treatment for light vs dark ends (0.16 step vs 0.05 step)
- Dark theme uses optical mixing rather than direct HSV manipulation
- The directional hue rotation is the key innovation — acknowledges that hue isn't perceptually linear

### Common With
jxnblk/palx (fixed-step HSL/HSV), tints.dev (hue manipulation from single base)

---

## primer/prism

**Repository URL:** https://github.com/primer/prism
**Primary Approach:** Algorithmic — curve-based offset system in perceptually uniform HSLuv

### Color Theory/Math Used
- **Color space:** HSLuv (perceptually uniform lightness — equal step size means equal perceived brightness regardless of hue)
- **Core formula:** `color[i] = base_color + curve_offset[i]` in HSLuv
- **Three independent curves:** Hue (0-360), Saturation (0-100), Lightness (0-100)
- **Curves can be mixed/matched across scales**
- **Bezier easing functions** as cubic bezier curves:
  - Linear: `bezier(0.5, 0.5, 0.5, 0.5)`
  - Quadratic in/out/inOut: `bezier(0.455, 0.03, 0.515, 0.955)`
  - Cubic in/out/inOut: `bezier(0.645, 0.045, 0.355, 1)`
  - Sine, Circular, Exponential — each with in/out/inOut
- **Contrast scoring:** contrast < 3 'Fail', < 4.5 'AA+', < 7 'AA', ≥ 7 'AAA'

### Technology Stack
- JavaScript/TypeScript, tailwind-merge
- Dependencies: hsluv, color2k, bezier-easing
- GUI-focused curve editor

### Key Implementation Details
- Separation of concerns: base colors define anchors, curves define distribution patterns — independently editable
- Bezier easing gives fine-grained control — designers craft precise color ramps
- Perceptually uniform HSLuv means lightness steps are consistent across all hues
- GitHub's actual design system tool

### Common With
tints.dev (HSLuv mode, curve-based lightness), poline (per-axis independent curves, easing functions)

---

## SimeonGriggs/tints.dev

**Repository URL:** https://github.com/SimeonGriggs/tints.dev
**Primary Approach:** Algorithmic — distance-based HSL parameter tweaks with linear interpolation anchors

### Color Theory/Math Used
- **Color spaces:** HSL (linear mode), HSLuv (perceived mode)
- **Hue tweak:** `abs(stopIndex - valueStopIndex) * h` (user-tunable `h` parameter, default 0)
- **Saturation tweak:** `min((|stopIndex - valueStopIndex| + 1) * s * (1 + |diff|/10), 100)` — non-linear, grows faster than linear as distance increases
- **Lightness:** Three-anchor system
  - Anchors: `(0, lMax)`, `(valueStop, baseLightness)`, `(1000, lMin)`
  - Linear interpolation between anchors: `leftAnchor.tweak + (rightAnchor.tweak - leftAnchor.tweak) * (stop - leftAnchor.stop) / (rightAnchor.stop - leftAnchor.stop)`
- **Stops:** [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 1000] (13-stop Tailwind scale)
- **Preserves exact input hex** at the designated valueStop (default 500)

### Technology Stack
- JavaScript/TypeScript, Next.js
- Dependencies: chroma-js, hsluv
- Web app + API endpoints

### Key Implementation Details
- Dual mode: 'linear' (raw HSL, fast) and 'perceived' (HSLuv, natural-looking)
- User-tunable h/s parameters adjust palette character without changing base color
- Three-anchor lightness: precise endpoint control independent of base brightness
- Non-linear saturation formula: `(diff+1)*s*(1+diff/10)` grows faster at extremes

### Common With
primer/prism (HSLuv space, curve-based lightness), jxnblk/palx (hue rotation + luminance stepping)

---

## meodai/poline

**Repository URL:** https://github.com/meodai/poline
**Primary Approach:** Algorithmic — 3D cartesian color space mapping with per-axis easing interpolation

### Color Theory/Math Used
- **Color space:** HSL mapped to 3D cartesian (x,y,z)
  - **HSL→Point:** `radians = h/(180/π)`, `dist = l * 0.5`, `x = 0.5 + dist·cos(radians)`, `y = 0.5 + dist·sin(radians)`, `z = s`
  - **Point→HSL:** `radians = atan2(y-0.5, x-0.5)`, `h = (360 + radians·180/π) % 360`, `s = z`, `dist = √((y-0.5)²+(x-0.5)²)`, `l = dist/0.5`
- **Multi-segment interpolation** between anchor points:
  `x = (1 - fx(t))·p1[0] + fx(t)·p2[0]` (same for y, z)
  Where fx, fy, fz are INDEPENDENT easing functions per axis
- **9 position functions:** linear, exponential (t²), quadratic (t³), cubic (t⁴), quartic (t⁵), sinusoidal (sin(t·π/2)), asinusoidal (asin(t)/(π/2)), arc (1-√(1-t)), smoothStep (t²·(3-2t)) — each with forward/reverse variants
- **Serpentine auto-inversion:** even-indexed segments reverse easing direction
- **Clamp-to-circle:** prevents out-of-gamut points
- **Closed-loop:** last anchor connects back to first

### Technology Stack
- Pure TypeScript, zero dependencies
- Single-file UMD module
- Approximate OKLCH/LCH CSS output via linear HSL rescaling

### Key Implementation Details
- **Core innovation:** treats HSL as 3D cartesian volume where (x,y) = polar position on color disc, z = saturation. This makes geometric sense — hue is angular, lightness is radial, saturation is altitude.
- Per-axis independent easing: sinusoidal hue transitions + exponential saturation drops + linear lightness ramps in ONE palette
- `getColorAt(t)` method: continuous sampling along entire multi-segment path
- Inverted lightness mode: center=dark/edge=light ↔ edge=dark/center=light

### Common With
primer/prism (curve-based interpolation, per-channel independent curves), spectral.js (novel/unique approach)

---

## rvanwijnen/spectral.js

**Repository URL:** https://github.com/rvanwijnen/spectral.js
**Primary Approach:** Physics-based — Kubelka-Munk spectral pigment mixing

### Color Theory/Math Used
- **Color space:** Spectral reflectance (38 bands, 380-730nm)
- **Kubelka-Munk theory** (1931 physics model for light scattering/absorption in pigmented layers):
  - **Absorption/scattering ratio:** `KS(R) = (1 - R)² / (2R)`
  - **Inverse:** `KM(KS) = 1 + KS - √(KS² + 2KS)`
  - **Mixing weight:** `concentration = factor² * tintingStrength² * luminance`
  - **Mixture at wavelength i:** `R[i] = KM( Σ(KS_i[pigment] * concentration[pigment]) / Σ(concentration[pigment]) )`
- **Full colorimetric pipeline:**
  1. sRGB → linear RGB (gamma un-companding)
  2. linear RGB → Spectral Reflectance via 7-base-spectra subtractive decomposition (White, Cyan, Magenta, Yellow, Red, Green, Blue) based on Neugebauer model
  3. Spectral → XYZ via CIE Color Matching Functions (3×38 matrix, D65 weighted)
  4. XYZ → OKLab via LMS cube root
  5. OKLab → OKLCh: `C = √(a²+b²)`, `h = atan2(b,a)·180/π`
  6. Gamut mapping: binary search on OKLCh chroma with deltaEOK JND threshold
  7. OKLab → XYZ → linear RGB → sRGB

### Technology Stack
- Pure JavaScript, zero dependencies
- Single-file UMD module
- Includes GLSL shader version (spectral.glsl) for GPU-accelerated spectral mixing

### Key Implementation Details
- **Physically realistic paint mixing:** blue + yellow actually makes green (subtractive mixing), not gray
- Metamerism preserved: colors that look the same under one illuminant but differ under another are handled correctly
- 38 wavelength bands at ~10nm spacing
- Gamut mapping preserves hue and lightness while finding closest valid chroma
- Concentration weighting accounts for luminance (darker colors have less tinting power)
- Gradient function with multi-stop interpolation for arbitrary color ramps

### Common With
meodai/poline (novel/unique approach), but spectral.js is in a category of its own — the only physics-based color mixer in this survey

---

### Collections, Plugins, & Format Tools

Repositories that organize, curate, or format color palettes rather than generating them algorithmically.

---

## jiffyclub/palettable

**Repository URL:** https://github.com/jiffyclub/palettable
**Primary Approach:** Hybrid — primarily curated collection + Cubehelix algorithm generator

### Color Theory/Math Used
- **Cubehelix algorithm** (D.A. Green, 2011):
  `rgb = lambd_gamma + amp * rot_matrix * [cos(phi), sin(phi)]`
  where `lambd` = linear brightness, `gamma` applies gamma correction, `phi = 2π·(start/3 + rotation·lambd)` controls helix angle, `amp = sat·lambd_gamma·(1 - lambd_gamma)/2`
- **Parameters:** start (0-3: blue/red/green), rotation (rainbow cycles), gamma, sat, min_light/max_light
- **Perceptual benefit:** monotonic brightness change — safe for grayscale printing/display

### Curated Collections:
- ColorBrewer (Cynthia Brewer's cartographic palettes)
- Tableau (20-color qualitative)
- Wes Anderson (film-inspired)
- MyCarta (perceptually uniform scientific)
- Light & Bartlein (diverging/sequential scientific)
- Fabio Crameri's scientific colour-maps
- Matplotlib & Plotly default colormaps

### Technology Stack
- Python 3.7+, numpy (optional for Cubehelix), matplotlib (optional for visualization)
- `Palette` base class with matplotlib integration (`LinearSegmentedColormap`), hex conversion, image export

### Key Implementation Details
- Palettes accessed by name with length suffix (e.g., 'Viridis_8')
- Reverse variants supported
- `evenly_spaced` sampling for arbitrary color counts
- Target audience: scientific visualization / matplotlib users

### Common With
Experience-Monks/nice-color-palettes, webkul/coolhue (curated collections), but palettable is the most comprehensive and includes Cubehelix generation

---

## Experience-Monks/nice-color-palettes

**Repository URL:** https://github.com/Experience-Monks/nice-color-palettes
**Primary Approach:** Curated collection — JSON palette dump from ColourLovers API

### Color Theory/Math Used
- **No algorithms** — pure data curation
- Fetched from ColourLovers API (`/api/palettes/top`) — top-rated user-created palettes
- Deduplication: identical palettes removed
- Filter: exactly 5 colors per palette

### Technology Stack
- Node.js scripts (got, map-limit, array-equal)
- npm package: `nice-color-palettes`
- Static HTML visualization page

### Key Implementation Details
- JSON format: `[['#hex1', '#hex2', '#hex3', '#hex4', '#hex5'], ...]`
- Sizes: 100.json, 200.json, 500.json, 1000.json
- Flat, anonymous — no categorization, no names, no metadata
- Pure data resource — useful as test data or seed palettes

### Common With
webkul/coolhue (curated collection), jiffyclub/palettable (curated portion)

---

## webkul/coolhue

**Repository URL:** https://github.com/webkul/coolhue
**Primary Approach:** Curated collection — hand-picked 2-color gradient swatches

### Color Theory/Math Used
- **No algorithms** — pure curation
- 60 hand-picked gradient pairs in JSON
- Rendered as CSS `linear-gradient(135deg, from 10%, to 100%)`
- No generation logic — all colors chosen by a human

### Technology Stack
- Vanilla HTML/CSS/JS frontend
- Distributions: Sketch plugin (CoolHue.sketchplugin), Photoshop gradient (.grd)

### Key Implementation Details
- JSON format: `[["#hexFrom", "#hexTo"], ...]`
- Each entry is anonymous — no categories or names
- Copy-to-clipboard functionality in web UI

### Common With
Experience-Monks/nice-color-palettes (curated, no generation)

---

## ment-mx/Prism

**Repository URL:** https://github.com/ment-mx/Prism
**Primary Approach:** Design tool plugin — Sketch plugin for color organization and naming

### Color Theory/Math Used
- **Color classification:** nearest-neighbor lookup in ~800 named CSS/web colors
- **Distance:** Euclidean `√((r1-r2)² + (g1-g2)² + (b1-b2)²)` in RGB space (NOT perceptually uniform)
- Reads colors from Sketch document assets

### Technology Stack
- CoffeeScript (compiled to JS), Sketch Plugin API (macOS)
- CocoaScript bridge, NSPasteboard/NSSavePanel for export

### Key Implementation Details
- Generates artboard with 4 color swatches per row + classified names
- Exports to 10 formats: Hex, RGBA CSS, SASS, CLR, ColorSet, UIColor Swift, UIColor ObjC, Android Java, Android XML, Sketch Measure
- Not a generator — reads existing document colors and formats them

### Common With
bjango/Color-Creator (design tool target audience, Sketch plugin)

---

## bjango/Color-Creator

**Repository URL:** https://github.com/bjango/Color-Creator
**Primary Approach:** Design templates — NO CODE

### Color Theory/Math Used
- **No code, no algorithms**
- Relies on application-native features: blend modes (multiply, screen, overlay), layer opacity, adjustment layers
- User fills in base swatch layers; template layers derive variations

### Technology Stack
- Static design files: Photoshop .psd, Sketch .sketch (2 versions), Affinity Designer .afdesign
- Markdown documentation

### Key Implementation Details
- Essentially a "color math" document — systematic layer structure doing visual color derivation
- Tints, shades, and related variations derived through application rendering engines
- No algorithm to analyze — purely a designer's workflow template

### Common With
ment-mx/Prism (design tool oriented, Sketch ecosystem)

---

## ozwaldorf/lutgen-rs

**Repository URL:** https://github.com/ozwaldorf/lutgen-rs
**Primary Approach:** Algorithmic — HALD CLUT generation with multiple interpolation methods in OKLab

### Color Theory/Math Used
- **Color space:** OKLab throughout (perceptually uniform)
- **NearestNeighborRemapper:** KD-tree search in OKLab with SquaredEuclidean distance; optional `preserve` mode keeps original L, maps only a,b
- **RBFRemapper (Linear/Shepard/Gaussian):**
  - Linear: `weight = distance`
  - Shepard (Inverse Distance): `weight = 1.0 / sqrt(distance)^power`
  - Gaussian: `weight = exp(-shape * distance)`
  - N nearest palette colors weighted by RBF, averaged in OKLab
- **GaussianSamplingRemapper:** Monte Carlo — N iterations of Gaussian noise in sRGB, snap to nearest palette, average
- **GaussianBlurRemapper:** 3D separable Gaussian blur on nearest-neighbor LUT cube in OKLab (3 passes with transpose for cache locality)
- **Formula details:** Conversion via `oklab` crate: `srgb_to_oklab` for input, `oklab_to_srgb` for output

### Technology Stack
- Rust (workspace: cli, lib, studio, palettes crates)
- `oklab` crate, `kiddo` (KD-tree), `rayon` (parallelism), `bpaf` (CLI), `quantette` (image quantization)
- WASM web UI via Trunk/Yew
- ~300+ curated palettes embedded at build time (Nord, Gruvbox, Catppuccin, Dracula, Tokyo Night, Solarized, etc.)

### Key Implementation Details
- ALL interpolation methods operate in OKLab — perceptual uniformity is the guiding principle
- KD-tree enables fast nearest-neighbor queries in 3D OKLab
- Separable 3D Gaussian blur is cache-efficient (transpose-based)
- GaussianSampling is slow but produces the smoothest interpolation
- Build-time palette compilation from TOML into embedded Rust arrays
- `quantette` dependency enables palette extraction from images as input

### Common With
primer/prism (perceptually uniform space as foundation), lokesh/color-thief (OKLCH/OKLab usage), spectral.js (serious color science approach)

---

## DingMouRen/PaletteImageView

**Repository URL:** https://github.com/DingMouRen/PaletteImageView
**Primary Approach:** Image extraction — Android View wrapper around Google's Palette library

### Color Theory/Math Used
- **Delegates to** `android.support.v7.graphics.Palette` (Google's Material Design palette extraction)
- Palette library internals (not in this repo): color quantization → HSL filtering → candidate scoring for Vibrant/Muted/Dominant profiles
- Each swatch includes RGB + recommended title/body text colors

### Technology Stack
- Java, Android SDK
- Custom View subclass (`PaletteImageView extends View`)
- Async palette generation

### Key Implementation Details
- Renders tinted drop shadow colored by dominant palette color
- Rounded corners on view
- Thin wrapper — no custom algorithm
- Quality/color count not configurable in this wrapper

### Common With
mrousavy/Colorwaver (delegates to native library rather than implementing own algorithm), fengsp/color-thief-py (image extraction category)

---

### Gradient Generators

Minimal gradient color selection tools with no color theory.

---

## henngelm/background-generator-javascript

**Repository URL:** https://github.com/henngelm/background-generator-javascript
**Primary Approach:** Gradient — random hex + manual color picker

### Color Theory/Math Used
- **Color space:** Hex RGB only — NO HSL/HSV/LAB
- **Random generation:** `'#'+(Math.random()*0xFFFFFF<<0).toString(16)` — pure random 24-bit hex, no color theory
- **Gradient:** CSS `linear-gradient(to right, color1, color2)`

### Technology Stack
- Vanilla HTML/CSS/JS
- Two HTML `<input type='color'>` pickers

### Key Implementation Details
- Random button generates arbitrary hex with no color theory whatsoever
- Purely a CSS gradient visualizer with random endpoint selection
- No harmony, no perceptually uniform space, no algorithm beyond `Math.random()`

### Common With
MichaelRendon/Background-Generator (gradient + no color theory), Korben-Coffman/Palette-Generator (raw RGB + no theory)

---

## MichaelRendon/Background-Generator

**Repository URL:** https://github.com/MichaelRendon/Background-Generator
**Primary Approach:** Gradient — manual hex color selection only

### Color Theory/Math Used
- **No generation algorithms** — entirely user-driven
- HTML `<input type='color'>` browser-native color pickers
- Default: cyan (#11D8EE) to magenta (#FC03E9)
- CSS `linear-gradient(to right, color1, color2)`

### Technology Stack
- Vanilla HTML/CSS/JS

### Key Implementation Details
- Simplest entry in the survey — no random generation, no algorithms, no color space
- Pure manual selection tool

### Common With
henngelm/background-generator-javascript (gradient tool, no color theory)

---

### Methodology & Philosophy (Non-Code Resource)

---

## Refactoring UI

**Repository URL:** https://refactoringui.com (commercial product, NOT a code repository)
**Primary Approach:** Manual systematic — explicitly REJECTS algorithmic generation

### Color Theory/Math Used
- **No mathematical formulas** — principle-based manual workflow
- **Core philosophy:** "It's not a science — trust your eyes, not the numbers"
- **Categories:** Greys (8-10 shades for text/backgrounds/panels), Primary colors (1-2 with 5-10 shades each), Accent colors (multiple with 5-10 shades each)
- **Process:**
  1. Choose base color at mid-range (suitable as button background) — visually, not mathematically
  2. Find edge shades manually by adjusting saturation and lightness
  3. Fill gaps via divide-and-conquer: pick shade 700 (between darkest and base), shade 300 (between base and lightest), then fill 800, 600, 400, 200
  4. Use 9-step numbering: 100 (lightest) through 900 (darkest), base at 500
- **Explicitly against:** automated CSS `lighten()`/`darken()` functions, algorithmic palette generators (triad, major fourth, etc.)
- **True black avoided** — dark grey preferred

### Technology Stack
- Not applicable — commercial book and methodology
- Created by Adam Wathan & Steve Schoger (Tailwind CSS creators)

### Key Implementation Details
- Influential methodology adopted by many design systems
- Tints.dev (SimeonGriggs) can be seen as an algorithmic implementation of this philosophy
- Manual visual tuning is presented as superior to mathematical generation

### Common With
tints.dev (filling the gap between Refactoring UI's manual methodology and algorithmic generation), primer/prism (design system tooling)

---

## Part 2: Commonality Analysis

### Approach Clusters

#### A. Image-Based Palette Extraction (4 repos)
**Shared technique:** All reduce an image to a representative color palette via quantization
**Repos:** fengsp/color-thief-py, lokesh/color-thief, 99designs/colorific, mrousavy/Colorwaver
**Common elements:**
- All use some form of color quantization to reduce thousands of colors to a handful
- MMCQ (Modified Median Cut Quantization) appears in both color-thief implementations
- Pixel filtering to exclude transparent/near-white pixels is universal
- Quality/sampling parameters trade accuracy for speed
- Output typically 2-5 dominant colors
**Key divergence:** `lokesh/color-thief` operates in OKLCH (perceptually uniform) while `fengsp/color-thief-py` operates in RGB (device-dependent). `99designs/colorific` adds a second perceptual merge pass using delta-E CMC in CIELAB.

#### B. Harmony Rule-Based Generators (4 repos)
**Shared technique:** Apply named color harmony rules (complementary, analogous, triadic) to a base color
**Repos:** eigenmiao/Rickrack, jcrispinroundtree/ColorPaletteRandomizer, Korben-Coffman/Palette-Generator, brettalford/Color-Palette-Generator
**Common elements:**
- Complementary (hue +180°) is the most universal rule
- Triadic (±120°) and Analogous (±30° typically) are common
- All work by starting from a single base color and deriving related colors
- Randomness/jitter is commonly added to avoid mechanical-looking results
**Key divergence:** Vast quality spread — Rickrack is production-grade with 7 rules, 6 sync modes, and RYB support; Korben-Coffman has no color theory at all (raw RGB inversion as "complementary"). Half use proper HSV/HSL conversions (Rickrack, brettalford), half rely on simpler approaches.

#### C. Algorithmic/Curve-Based Palette Generators (6 repos)
**Shared technique:** Generate full color scales from a base color via mathematical interpolation or stepping
**Repos:** jxnblk/palx, ant-design/ant-design-colors, primer/prism, tints.dev, meodai/poline, rvanwijnen/spectral.js
**Common elements:**
- All start from one or more anchor/base colors
- Mathematical functions determine intermediate colors
- Easing functions and interpolation curves control the distribution pattern
- Perceptually uniform color spaces (HSLuv, OKLab, OKLCH) appear in the more advanced tools
**Key divergence:** Range from simple (palx: fixed 30° hue rotation + 10 luminance levels) to physics-based (spectral.js: Kubelka-Munk spectral mixing). poline stands alone in its 3D cartesian mapping approach. spectral.js is unique in operating in the spectral domain rather than any perceptual color space.

#### D. Curated Collections (3 repos)
**Shared technique:** Pre-defined palettes, no generation algorithm
**Repos:** jiffyclub/palettable, Experience-Monks/nice-color-palettes, webkul/coolhue
**Common elements:**
- Flat arrays of hex colors in standardized formats
- Sourced from humans (designers, ColourLovers community, cartographers)
- No generation logic — pure data
- JSON is the dominant storage format

#### E. Design Tool Plugins/Templates (2 repos)
**Shared technique:** Work within existing design applications rather than standalone generation
**Repos:** ment-mx/Prism, bjango/Color-Creator
**Common elements:**
- Target Sketch/Photoshop/Affinity Designer users
- Organize/format existing colors rather than generate new ones
- Export to multiple design-oriented formats

### Frequently Used Color Spaces

| Color Space | Usage Count | Repos Using It |
|---|---|---|
| **RGB (raw)** | 10 | color-thief-py, Korben-Coffman, gradient gens, Prism, coolhue, nice-color-palettes, Colorwaver, PaletteImageView, Refactoring UI |
| **HSL** | 6 | palx, tints.dev (linear mode), poline, brettalford, Rickrack, color-thief (JS output) |
| **HSV/HSB** | 4 | ant-design-colors, Rickrack, ColorPaletteRandomizer, colorific (saturation filter) |
| **OKLab/OKLCH** | 4 | lokesh/color-thief (default), lutgen-rs, spectral.js (post-spectral), tints.dev (HSLuv mode) |
| **HSLuv** | 2 | primer/prism, tints.dev (perceived mode) |
| **CIELAB** | 2 | colorific (delta-E CMC), Rickrack (LAB output) |
| **Spectral** | 1 | spectral.js (38 bands, 380-730nm) |
| **RYB** | 1 | Rickrack (artist's color wheel) |
| **XYZ** | 2 | colorific, spectral.js (intermediate) |

### Common Design Theories & Harmony Rules

**Most implemented harmony rules (across 4 harmony repos + algorithmic repos that use hue relationships):**

1. **Complementary (hue +180°):** 5 repos (Rickrack, ColorPaletteRandomizer, Korben-Coffman, brettalford, spectral.js)
2. **Triadic (±120°):** 4 repos (Rickrack, ColorPaletteRandomizer, brettalford via clashing, palx)
3. **Analogous (±15-30°):** 3 repos (Rickrack, ColorPaletteRandomizer, brettalford)
4. **Monochromatic (same hue, varied S/V):** 3 repos (Rickrack, ColorPaletteRandomizer, palx)
5. **Tetrad (±90°/±180°):** 1 repo (Rickrack)
6. **Pentad (±72°/±144°):** 1 repo (Rickrack)

**Notable gap:** No repository implements the **golden ratio** (φ ≈ 1.618) for hue angle selection — an approach common in color theory literature but absent from all surveyed codebases.

**Perceptual uniformity trend:** The more sophisticated repos (lokesh/color-thief, primer/prism, lutgen-rs, tints.dev) ALL converge on perceptually uniform color spaces (OKLab/OKLCH/HSLuv). This is the clearest signal in the data — perceptual uniformity is the direction the field is moving.

---

## Part 3: Summary Statistics

| Category | Count | Repos |
|---|---|---|
| Image extraction | 4 | color-thief-py, color-thief, colorific, Colorwaver |
| Harmony/rule-based | 4 | Rickrack, ColorPaletteRandomizer, Korben-Coffman, brettalford |
| Algorithmic/curve-based | 6 | palx, ant-design-colors, primer/prism, tints.dev, poline, spectral.js |
| Curated collections | 3 | palettable, nice-color-palettes, coolhue |
| Design plugins/templates | 2 | Prism (ment-mx), Color-Creator |
| Gradient tools (no theory) | 2 | henngelm, MichaelRendon |
| Utility/generator (advanced) | 1 | lutgen-rs |
| Android wrapper | 1 | PaletteImageView |
| Methodology (non-code) | 1 | Refactoring UI |

**Total unique entries analyzed:** 24
