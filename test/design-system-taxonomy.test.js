import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDesignArchetype,
  classifyDesignSystem,
  designArchetypeCentroids,
  designArchetypeVariantGuidance,
  designSystemGuidance,
  designSystemProfiles,
  extractDesignArchetypeFeatures
} from "../dist/design-system-taxonomy.js";

test("design system taxonomy exposes the v1 researched styles", () => {
  const ids = designSystemProfiles().map((profile) => profile.id);
  assert.deepEqual(ids, [
    "swiss-international",
    "bento-grid",
    "neo-minimalism",
    "neo-brutalism",
    "maximalism"
  ]);
});

test("design archetype model exposes the requested five centroids", () => {
  const ids = designArchetypeCentroids().map((archetype) => archetype.id);
  assert.deepEqual(ids, [
    "utility-first",
    "component-semantic",
    "css-in-js-atomic",
    "design-token-driven",
    "classical-cascade"
  ]);
});

test("design archetype feature extractor measures utility classes, tokens, specificity, and implementation signals", () => {
  const features = extractDesignArchetypeFeatures({
    html: `<section class="flex md:grid gap-4 BEM__title is-active css-a1b2c3" data-state="open" style="--local-gap: 1rem; color: var(--color-fg)"></section><x-card></x-card>`,
    css: `:root { --color-fg: #111; --space-2: .5rem; }
      .BEM__title.is-active #hero > .copy { color: var(--color-fg) !important; }
      @media (min-width: 40rem) { .card { & .title { color: red; } } }
      const styledButton = styled.button\`color: ${"${tokens.fg}"};\`;`
  });

  assert.ok(features.utility_class_ratio > 0);
  assert.equal(features.custom_property_count, 3);
  assert.ok(features.avg_specificity > 0.1);
  assert.ok(features.nesting_depth_avg > 0);
  assert.ok(features.important_ratio > 0);
  assert.ok(features.bem_class_ratio > 0);
  assert.ok(features.hash_suffix_ratio > 0);
  assert.ok(features.data_attr_style_ratio > 0);
  assert.equal(features.css_in_js_detected, 1);
  assert.equal(features.shadow_dom_used, 1);
});

test("design archetype classifier uses centroid distance and softmax probabilities", () => {
  const utility = classifyDesignArchetype({
    html: `<main class="flex grid gap-4 p-4 md:p-8 text-sm font-bold bg-white text-slate-900 rounded-lg shadow hover:bg-slate-50"></main>`,
    css: `.sr-only { position: absolute; }`
  });
  assert.equal(utility.primary.id, "utility-first");
  assert.ok(utility.primary.probability > 0.5);
  assert.equal(Number(Object.values(utility.probabilities).reduce((sum, value) => sum + value, 0).toFixed(6)), 1);
  assert.ok(utility.distances[utility.primary.id] <= utility.distances[utility.secondary.id]);

  const tokens = classifyDesignArchetype({
    html: `<button class="Button" data-variant="primary"></button>`,
    css: `:root { --color-bg: #fff; --color-fg: #111; --space-1: .25rem; --space-2: .5rem; --radius-sm: .25rem; --shadow-sm: 0 1px 2px #0002; }
      .Button { background: var(--color-bg); color: var(--color-fg); padding: var(--space-2); border-radius: var(--radius-sm); }`
  });
  assert.equal(tokens.primary.id, "design-token-driven");
  assert.ok(tokens.feature_vector.custom_property_count >= 6);
});

test("design archetype variant guidance constrains safe implementation variation", () => {
  const tokens = classifyDesignArchetype({
    html: `<button class="Button" data-variant="primary"></button>`,
    css: `:root { --color-bg: #fff; --color-fg: #111; --space-1: .25rem; --space-2: .5rem; --radius-sm: .25rem; --shadow-sm: 0 1px 2px #0002; }
      .Button { background: var(--color-bg); color: var(--color-fg); padding: var(--space-2); border-radius: var(--radius-sm); transition: transform 180ms ease-out; }`
  });
  const guidance = designArchetypeVariantGuidance(tokens);

  assert.equal(guidance.schema, "rizzfizz.design-archetype-variant-guidance.v1");
  assert.equal(guidance.primary_archetype, "design-token-driven");
  assert.ok(guidance.safe_variation_rules.length >= 4);
  assert.match(guidance.safe_variation_rules.join(" "), /custom properties|semantic token/i);
  assert.match(guidance.do_not_clone.join(" "), /class names|asset paths|animation timing/i);
  assert.ok(guidance.variant_constraints.locked.some((item) => /token contract/i.test(item)));
  assert.ok(guidance.variant_constraints.may_vary.some((item) => /palette/i.test(item)));
});

test("classifier identifies Swiss / International qualities", () => {
  const result = classifyDesignSystem({
    text: "Strict column grid, mathematical alignment, neutral sans typography, zero clutter, clear hierarchy, functional precise interaction.",
    relationship: "product-clear"
  });
  assert.equal(result.primary.id, "swiss-international");
  assert.match(result.matched_qualities.join(" "), /grid behavior/);
  assert.match(result.primary.qualities.grid_behavior, /Absolute devotion/);
});

test("classifier identifies Bento Grid qualities", () => {
  const result = classifyDesignSystem({
    text: "Modern modular dashboard with bento tiles, grouped widgets, rounded panels, compact labels, and stable cells.",
    relationship: "product-clear"
  });
  assert.equal(result.primary.id, "bento-grid");
  assert.match(result.primary.qualities.logical_unit, /Organism/);
});

test("classifier identifies Neo-Minimalism qualities", () => {
  const result = classifyDesignSystem({
    text: "Minimal type-first editorial layout with sparse content, generous whitespace, restrained accents, calm premium interaction.",
    relationship: "light-editorial-accent"
  });
  assert.equal(result.primary.id, "neo-minimalism");
  assert.match(result.primary.qualities.entropy, /Very low/);
});

test("classifier identifies Neo-Brutalism qualities", () => {
  const result = classifyDesignSystem({
    text: "Neo-brutal raw blocky interface with visible grid, hard edge panels, strong borders, heavy type, and aggressive tactile states.",
    relationship: "dark-sparse-accent"
  });
  assert.equal(result.primary.id, "neo-brutalism");
  assert.match(result.primary.qualities.interaction_feel, /aggressive/);
});

test("classifier identifies Maximalism qualities", () => {
  const result = classifyDesignSystem({
    text: "Maximal story-led page with anti-grid composition, layered texture, expressive display type, dramatic focal shifts, playful emotional energy.",
    relationship: "immersive-chroma"
  });
  assert.equal(result.primary.id, "maximalism");
  assert.match(result.primary.qualities.entropy, /High controlled/);
});

test("classifier returns secondary signal for mixed style direction", () => {
  const result = classifyDesignSystem({
    text: "Strict column grid and alignment with bento modular cells, grouped panels, compact labels, clear hierarchy, and controlled clutter.",
    relationship: "product-clear"
  });
  assert.equal(result.primary.id, "bento-grid");
  assert.equal(result.secondary?.id, "swiss-international");
  assert.ok(designSystemGuidance(result).length >= 2);
});

test("classifier source evidence is sanitized", () => {
  const result = classifyDesignSystem({
    text: "Linear style strict grid from https://example.test with Apple-like bento modules and zero clutter.",
    relationship: "product-clear"
  });
  const evidence = result.source_safe_evidence.join(" ");
  assert.equal(evidence.includes("https://example.test"), false);
  assert.equal(evidence.includes("Linear"), false);
  assert.equal(evidence.includes("Apple"), false);
  assert.ok(result.source_safe_evidence.every((item) => /^(term|quality):/.test(item)));
});

test("classifier source evidence never copies distinctive source slogans", () => {
  const slogan = "ZEPHYR_CALM_CINEMATIC_SLOGAN_9f3a";
  const result = classifyDesignSystem({
    text: `${slogan} spacious gallery with calm premium hierarchy and restrained motion.`,
    relationship: "gallery-neutral"
  });
  assert.equal(result.source_safe_evidence.join(" ").includes(slogan), false);
  assert.ok(result.source_safe_evidence.every((item) => /^(term|quality):/.test(item)));
});
