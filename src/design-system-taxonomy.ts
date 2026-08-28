import type { PaletteRun } from "./types.js";

export type DesignSystemStyleId =
  | "swiss-international"
  | "bento-grid"
  | "neo-minimalism"
  | "neo-brutalism"
  | "maximalism";

export type DesignSystemQualities = {
  logical_unit: string;
  grid_behavior: string;
  density: string;
  hierarchy: string;
  typography: string;
  ornamentation: string;
  entropy: string;
  interaction_feel: string;
  token_usage: string;
};

export type DesignSystemStyleProfile = {
  id: DesignSystemStyleId;
  name: string;
  summary: string;
  qualities: DesignSystemQualities;
  builder_guidance: string[];
};

export type DesignSystemClassification = {
  schema: "rizzfizz.design-system-classification.v1";
  primary: DesignSystemStyleMatch;
  secondary: DesignSystemStyleMatch | null;
  matched_qualities: string[];
  source_safe_evidence: string[];
};

export type DesignSystemStyleMatch = {
  id: DesignSystemStyleId;
  name: string;
  summary: string;
  confidence: number;
  confidence_label: "low" | "medium" | "high";
  score: number;
  qualities: DesignSystemQualities;
  builder_guidance: string[];
};

type WeightedKeywords = {
  grid: string[];
  density: string[];
  hierarchy: string[];
  typography: string[];
  ornamentation: string[];
  entropy: string[];
  interaction: string[];
  tokens: string[];
  palette: string[];
};

type InternalProfile = DesignSystemStyleProfile & {
  keywords: WeightedKeywords;
  palette_relationships: string[];
};

const PROFILES: InternalProfile[] = [
  {
    id: "swiss-international",
    name: "Swiss / International",
    summary: "Column-led modernist clarity with absolute devotion to grid and academic hierarchy discipline.",
    qualities: {
      logical_unit: "The Column",
      grid_behavior: "Absolute devotion to strict column grid and visible alignment discipline.",
      density: "Academic clarity: moderate to compact, with whitespace used to clarify priority.",
      hierarchy: "High hierarchy discipline through scale, position, and contrast.",
      typography: "Typography-led, neutral, clear, and systematized.",
      ornamentation: "Low ornament; structure carries the visual identity.",
      entropy: "Low visual entropy and high perceptual fluency.",
      interaction_feel: "Academic, clear, precise, quiet, and fast.",
      token_usage: "Neutral tokens dominate; accent marks active or critical states only."
    },
    builder_guidance: [
      "Use a strict column grid and align labels, controls, and content edges deliberately.",
      "Let typography and spacing create hierarchy before adding decorative treatment.",
      "Keep visual entropy low: one primary focal path, restrained accents, and no ornamental clutter."
    ],
    keywords: {
      grid: ["swiss", "international", "column", "grid", "strict grid", "alignment", "aligned", "modernist", "muller", "brockmann"],
      density: ["clear", "structured", "compact", "disciplined", "spacious"],
      hierarchy: ["hierarchy", "ordered", "systematic", "clarity", "legible", "scan"],
      typography: ["typography", "type", "neutral type", "sans", "labels", "caption"],
      ornamentation: ["minimal ornament", "low ornament", "restrained", "reduction"],
      entropy: ["low entropy", "low complexity", "zero clutter", "no clutter"],
      interaction: ["precise", "fast", "functional", "quiet"],
      tokens: ["neutral", "muted", "focus", "state"],
      palette: ["dark-sparse-accent", "product-clear", "gallery-neutral", "light-editorial-accent"]
    },
    palette_relationships: ["dark-sparse-accent", "product-clear", "gallery-neutral", "light-editorial-accent"]
  },
  {
    id: "bento-grid",
    name: "Bento Grid",
    summary: "Modular organism layout with rigid cells and organized modern grouping.",
    qualities: {
      logical_unit: "The Organism",
      grid_behavior: "Modular, rigid cells with stable panel spans.",
      density: "Organized medium density, often scan-first.",
      hierarchy: "Hierarchy comes from panel size, grouping, and cell position.",
      typography: "Compact labels and clear headings inside bounded modules.",
      ornamentation: "Low to moderate; panels and cells are the main visual device.",
      entropy: "Controlled entropy through repeated modules.",
      interaction_feel: "Organized, modern, tactile.",
      token_usage: "Surface, border, radius, and focus tokens must be consistent across modules."
    },
    builder_guidance: [
      "Use stable modular cells with clear spans and no nested-card clutter.",
      "Group related content into repeated panels with consistent radius, border, and surface tokens.",
      "Make responsive behavior preserve module order and primary workflow rather than collapsing into a generic stack."
    ],
    keywords: {
      grid: ["bento", "modular", "module", "cells", "tiles", "grid cards", "dashboard", "panels", "widgets"],
      density: ["organized", "modern", "grouped", "scan", "overview"],
      hierarchy: ["summary", "panel size", "priority", "modules", "sections"],
      typography: ["compact labels", "labels", "metadata", "caption"],
      ornamentation: ["rounded", "squircle", "panel", "surface", "cards"],
      entropy: ["controlled", "organized", "structured"],
      interaction: ["product", "workflow", "controls", "states", "tactile"],
      tokens: ["surface", "border", "radius", "focus", "panel"],
      palette: ["product-clear", "dark-sparse-accent"]
    },
    palette_relationships: ["product-clear", "dark-sparse-accent"]
  },
  {
    id: "neo-minimalism",
    name: "Neo-Minimalism",
    summary: "Typography-first atomism with essentialist surfaces and premium sharpness.",
    qualities: {
      logical_unit: "The Atom (Typography)",
      grid_behavior: "Essentialist grid: only the layout moves needed to support typography.",
      density: "Sparse, calm, and whitespace-forward.",
      hierarchy: "Hierarchy comes from type scale, weight, and negative space.",
      typography: "Typography is the primary visual material.",
      ornamentation: "Very low ornament; remove anything that does not support the task.",
      entropy: "Very low visual entropy.",
      interaction_feel: "Premium, sharp, calm, and unobtrusive.",
      token_usage: "Small token set with careful contrast, neutral surfaces, and sparse accent."
    },
    builder_guidance: [
      "Prioritize type scale, spacing, and contrast over decorative panels or effects.",
      "Use generous negative space while keeping the primary action visible.",
      "Keep the token set small and avoid adding extra colors, shadows, or motion without a job."
    ],
    keywords: {
      grid: ["minimal", "essential", "simple layout", "reduction", "content-led"],
      density: ["minimal", "sparse", "spacious", "calm", "quiet", "generous whitespace", "luxury"],
      hierarchy: ["type scale", "negative space", "focus", "single focal", "premium"],
      typography: ["typography", "type-first", "type first", "large type", "sharp", "editorial"],
      ornamentation: ["no decoration", "low ornament", "restrained", "essentialist"],
      entropy: ["low entropy", "low complexity", "clean", "zero clutter"],
      interaction: ["calm", "premium", "subtle", "quiet"],
      tokens: ["neutral", "sparse accent", "contrast", "paper"],
      palette: ["light-editorial-accent", "dark-sparse-accent", "gallery-neutral"]
    },
    palette_relationships: ["light-editorial-accent", "dark-sparse-accent", "gallery-neutral"]
  },
  {
    id: "neo-brutalism",
    name: "Neo-Brutalism",
    summary: "Raw material presentation with visible clunky grid, hard edges, and honest aggression.",
    qualities: {
      logical_unit: "The Raw Material",
      grid_behavior: "Visible, clunky grid with blunt raw-material structure.",
      density: "Medium to dense, with direct exposed grouping.",
      hierarchy: "Hierarchy uses strong borders, blocks, scale jumps, and contrast.",
      typography: "Heavy, blunt, and utilitarian.",
      ornamentation: "Raw structural ornament: borders, blocks, offsets, and exposed mechanics.",
      entropy: "Moderate entropy, intentionally forceful but still usable.",
      interaction_feel: "Honest, aggressive, immediate, and tactile.",
      token_usage: "High-contrast tokens, visible lines, and direct state changes."
    },
    builder_guidance: [
      "Use visible structure: strong borders, direct blocks, and clear state changes.",
      "Keep the rawness intentional; do not let aggressive treatment break readability or accessibility.",
      "Use hard contrast and blunt hierarchy without copying source-specific slogans or marks."
    ],
    keywords: {
      grid: ["brutalist", "neo-brutal", "raw", "clunky", "visible grid", "blocky", "offset", "hard edge"],
      density: ["dense", "loud", "direct", "raw"],
      hierarchy: ["bold", "heavy", "strong borders", "blocks", "contrast", "oversized"],
      typography: ["heavy type", "bold type", "mono", "utilitarian", "uppercase"],
      ornamentation: ["border", "shadow", "raw material", "exposed", "outlined"],
      entropy: ["aggressive", "jarring", "high contrast", "forceful"],
      interaction: ["tactile", "immediate", "honest", "aggressive"],
      tokens: ["line", "border", "accent", "contrast"],
      palette: ["product-clear", "dark-sparse-accent"]
    },
    palette_relationships: ["product-clear", "dark-sparse-accent"]
  },
  {
    id: "maximalism",
    name: "Maximalism",
    summary: "Story-led emotional composition with anti-grid or loose-grid density.",
    qualities: {
      logical_unit: "The Story",
      grid_behavior: "Anti-grid or loose-grid composition driven by story.",
      density: "Crowded, dense, expressive, and content-rich.",
      hierarchy: "Hierarchy comes from narrative sequencing, contrast, and dramatic focal shifts.",
      typography: "Expressive type pairings and display moments.",
      ornamentation: "High ornament and layered visual devices.",
      entropy: "High controlled entropy; density must remain navigable.",
      interaction_feel: "Emotional, energetic, playful, or cinematic.",
      token_usage: "Accent and effect tokens can be expressive, but roles must remain semantic."
    },
    builder_guidance: [
      "Use expressive density in a controlled narrative path, not random decoration.",
      "Allow layered visuals and dramatic type moments while preserving readable content and actions.",
      "Check visual entropy explicitly on mobile so energy does not become overlap or clutter."
    ],
    keywords: {
      grid: ["maximal", "anti-grid", "loose grid", "layered", "overlap", "story", "narrative"],
      density: ["dense", "crowded", "rich", "layered", "abundant", "expressive"],
      hierarchy: ["story", "narrative", "dramatic", "focal shifts", "emotional"],
      typography: ["expressive type", "display type", "type pairing", "dramatic type"],
      ornamentation: ["ornament", "decorative", "texture", "illustration", "pattern", "effects"],
      entropy: ["high entropy", "visual complexity", "busy", "crowded"],
      interaction: ["playful", "emotional", "energetic", "cinematic", "expressive"],
      tokens: ["accent", "effect", "gradient", "chroma"],
      palette: ["immersive-chroma"]
    },
    palette_relationships: ["immersive-chroma"]
  }
];

const CATEGORY_WEIGHTS: Record<keyof WeightedKeywords, number> = {
  grid: 2.2,
  density: 1.4,
  hierarchy: 1.5,
  typography: 1.6,
  ornamentation: 1.3,
  entropy: 1.5,
  interaction: 1.2,
  tokens: 1,
  palette: 0.7
};

export type DesignArchetypeId =
  | "utility-first"
  | "component-semantic"
  | "css-in-js-atomic"
  | "design-token-driven"
  | "classical-cascade";

export type DesignArchetypeFeatures = {
  utility_class_ratio: number;
  custom_property_count: number;
  avg_specificity: number;
  nesting_depth_avg: number;
  important_ratio: number;
  bem_class_ratio: number;
  hash_suffix_ratio: number;
  data_attr_style_ratio: number;
  css_in_js_detected: number;
  shadow_dom_used: number;
};

export type DesignArchetypeCentroid = {
  id: DesignArchetypeId;
  name: string;
  summary: string;
  centroid: DesignArchetypeFeatures;
};

export type DesignArchetypeMatch = {
  id: DesignArchetypeId;
  name: string;
  summary: string;
  probability: number;
  distance: number;
};

export type DesignArchetypeClassification = {
  schema: "rizzfizz.design-archetype-classification.v1";
  primary: DesignArchetypeMatch;
  secondary: DesignArchetypeMatch;
  feature_vector: DesignArchetypeFeatures;
  probabilities: Record<DesignArchetypeId, number>;
  distances: Record<DesignArchetypeId, number>;
};

export type DesignArchetypeVariantGuidance = {
  schema: "rizzfizz.design-archetype-variant-guidance.v1";
  primary_archetype: DesignArchetypeId;
  confidence: number;
  safe_variation_rules: string[];
  variant_constraints: {
    locked: string[];
    may_vary: string[];
    verify: string[];
  };
  do_not_clone: string[];
};

type DesignArchetypeInput = {
  html?: string;
  css?: string;
  javascript?: string;
  text?: string;
};

const FEATURE_KEYS: Array<keyof DesignArchetypeFeatures> = [
  "utility_class_ratio",
  "custom_property_count",
  "avg_specificity",
  "nesting_depth_avg",
  "important_ratio",
  "bem_class_ratio",
  "hash_suffix_ratio",
  "data_attr_style_ratio",
  "css_in_js_detected",
  "shadow_dom_used"
];

const ARCHETYPE_CENTROIDS: DesignArchetypeCentroid[] = [
  {
    id: "utility-first",
    name: "Utility-first",
    summary: "Markup carries most styling through composable utility classes and low semantic CSS surface area.",
    centroid: {
      utility_class_ratio: 0.78,
      custom_property_count: 0.1,
      avg_specificity: 0.18,
      nesting_depth_avg: 0.05,
      important_ratio: 0.08,
      bem_class_ratio: 0.02,
      hash_suffix_ratio: 0.02,
      data_attr_style_ratio: 0.12,
      css_in_js_detected: 0,
      shadow_dom_used: 0
    }
  },
  {
    id: "component-semantic",
    name: "Component-semantic",
    summary: "Human-readable component classes and states encode design intent with moderate scoped CSS.",
    centroid: {
      utility_class_ratio: 0.15,
      custom_property_count: 0.25,
      avg_specificity: 0.32,
      nesting_depth_avg: 0.18,
      important_ratio: 0.03,
      bem_class_ratio: 0.42,
      hash_suffix_ratio: 0.04,
      data_attr_style_ratio: 0.24,
      css_in_js_detected: 0,
      shadow_dom_used: 0.04
    }
  },
  {
    id: "css-in-js-atomic",
    name: "CSS-in-JS atomic",
    summary: "Runtime or build-time generated atomic styles with hashed class names and CSS-in-JS signals.",
    centroid: {
      utility_class_ratio: 0.28,
      custom_property_count: 0.22,
      avg_specificity: 0.14,
      nesting_depth_avg: 0.08,
      important_ratio: 0.02,
      bem_class_ratio: 0.02,
      hash_suffix_ratio: 0.68,
      data_attr_style_ratio: 0.18,
      css_in_js_detected: 1,
      shadow_dom_used: 0.04
    }
  },
  {
    id: "design-token-driven",
    name: "Design-token-driven",
    summary: "Custom properties and token references dominate styling decisions across otherwise mixed CSS patterns.",
    centroid: {
      utility_class_ratio: 0.18,
      custom_property_count: 0.82,
      avg_specificity: 0.24,
      nesting_depth_avg: 0.14,
      important_ratio: 0.02,
      bem_class_ratio: 0.18,
      hash_suffix_ratio: 0.04,
      data_attr_style_ratio: 0.22,
      css_in_js_detected: 0.12,
      shadow_dom_used: 0.08
    }
  },
  {
    id: "classical-cascade",
    name: "Classical cascade",
    summary: "Traditional stylesheet cascade with descendant selectors, specificity, nesting, and occasional overrides.",
    centroid: {
      utility_class_ratio: 0.05,
      custom_property_count: 0.08,
      avg_specificity: 0.62,
      nesting_depth_avg: 0.52,
      important_ratio: 0.16,
      bem_class_ratio: 0.08,
      hash_suffix_ratio: 0.02,
      data_attr_style_ratio: 0.06,
      css_in_js_detected: 0,
      shadow_dom_used: 0.02
    }
  }
];

export function designSystemProfiles(): DesignSystemStyleProfile[] {
  return PROFILES.map(({ keywords, palette_relationships, ...profile }) => profile);
}

export function designArchetypeCentroids(): DesignArchetypeCentroid[] {
  return ARCHETYPE_CENTROIDS.map((archetype) => ({
    ...archetype,
    centroid: { ...archetype.centroid }
  }));
}

export function extractDesignArchetypeFeatures(input: DesignArchetypeInput): DesignArchetypeFeatures {
  const html = input.html || "";
  const css = input.css || "";
  const javascript = input.javascript || "";
  const text = input.text || "";
  const combined = `${html}\n${css}\n${javascript}\n${text}`;
  const classNames = extractClassNames(`${html}\n${text}`);
  const classCount = Math.max(1, classNames.length);
  const selectors = extractCssSelectors(css);
  const specificities = selectors.map(selectorSpecificity);
  const declarationCount = Math.max(1, countCssDeclarations(css));

  return {
    utility_class_ratio: roundFeature(classNames.filter(isUtilityClass).length / classCount),
    custom_property_count: countUniqueMatches(combined, /(?:^|[^\w-])(--[A-Za-z0-9_-]+)\s*:/g),
    avg_specificity: roundFeature(specificities.length ? average(specificities) : 0),
    nesting_depth_avg: roundFeature(averageNestingDepth(css)),
    important_ratio: roundFeature((css.match(/!important\b/g) || []).length / declarationCount),
    bem_class_ratio: roundFeature(classNames.filter(isBemClass).length / classCount),
    hash_suffix_ratio: roundFeature(classNames.filter(isHashLikeClass).length / classCount),
    data_attr_style_ratio: roundFeature(dataOrStyleElementRatio(html || text)),
    css_in_js_detected: detectsCssInJs(combined) ? 1 : 0,
    shadow_dom_used: detectsShadowDom(combined) ? 1 : 0
  };
}

export function classifyDesignArchetype(input: DesignArchetypeInput): DesignArchetypeClassification {
  const featureVector = extractDesignArchetypeFeatures(input);
  const normalized = normalizeArchetypeFeatures(featureVector);
  const scored = ARCHETYPE_CENTROIDS.map((archetype) => {
    const distance = euclideanDistance(normalized, archetype.centroid);
    return { archetype, distance };
  }).sort((a, b) => a.distance - b.distance);
  const probabilities = softmaxProbabilities(scored.map((score) => -score.distance * 9));
  const probabilityById = {} as Record<DesignArchetypeId, number>;
  const distanceById = {} as Record<DesignArchetypeId, number>;
  scored.forEach((score, index) => {
    probabilityById[score.archetype.id] = probabilities[index];
    distanceById[score.archetype.id] = roundFeature(score.distance);
  });

  return {
    schema: "rizzfizz.design-archetype-classification.v1",
    primary: toArchetypeMatch(scored[0], probabilityById[scored[0].archetype.id]),
    secondary: toArchetypeMatch(scored[1], probabilityById[scored[1].archetype.id]),
    feature_vector: featureVector,
    probabilities: probabilityById,
    distances: distanceById
  };
}

export function designArchetypeVariantGuidance(classification: DesignArchetypeClassification): DesignArchetypeVariantGuidance {
  const primary = classification.primary.id;
  const baseRules = [
    "Preserve implementation archetype as a constraint, not as source identity: variants may change expression while keeping the same styling contract.",
    "Keep responsive behavior, hover/focus/active states, and reduced-motion expectations explicit in each variant brief.",
    "Use screenshot or visual-diff review at desktop and mobile sizes to catch drift in density, hierarchy, and component anatomy.",
    "Do not copy source class names, generated asset paths, tracking snippets, exact animation timing, or DOM structure."
  ];
  const byArchetype: Record<DesignArchetypeId, Pick<DesignArchetypeVariantGuidance["variant_constraints"], "locked" | "may_vary" | "verify"> & { rules: string[] }> = {
    "utility-first": {
      rules: [
        "Keep styling decisions in composable utility classes or generated utility tokens; avoid migrating variants into a high-specificity stylesheet.",
        "Vary palette, spacing scale, and component density through utility-class substitutions rather than bespoke one-off CSS."
      ],
      locked: ["utility-class implementation contract", "low selector specificity", "responsive state coverage"],
      may_vary: ["palette utilities", "spacing scale", "grid spans", "radius and shadow utilities"],
      verify: ["utility class ratio remains dominant", "no new cascade override layer", "focus and responsive states are represented"]
    },
    "component-semantic": {
      rules: [
        "Keep semantic component and state classes readable; variants should add new component roles instead of leaking source-specific names.",
        "Vary component anatomy, density, and state treatment inside the existing semantic class contract."
      ],
      locked: ["component-semantic naming contract", "stateful component boundaries", "moderate specificity budget"],
      may_vary: ["component layout", "palette roles", "state accents", "module density"],
      verify: ["class names remain generic and source-safe", "component states are covered", "specificity stays moderate"]
    },
    "css-in-js-atomic": {
      rules: [
        "Keep generated or atomic styling encapsulated; variants should alter tokens/props instead of hard-coding copied class hashes.",
        "Treat hash-like selectors as private build artifacts and never as reusable design evidence."
      ],
      locked: ["atomic styling contract", "encapsulation boundary", "prop/token-driven variants"],
      may_vary: ["theme props", "runtime token values", "component variants", "motion feel"],
      verify: ["no copied hash classes", "generated styles are source-safe", "runtime styling has SSR-safe fallback"]
    },
    "design-token-driven": {
      rules: [
        "Keep custom properties and semantic token roles as the source of variation; variants should swap token values before changing component CSS.",
        "Vary palette, radius, shadow, spacing, and motion tokens while preserving the semantic token contract."
      ],
      locked: ["semantic token contract", "custom properties as primary styling API", "component CSS consumes tokens"],
      may_vary: ["palette tokens", "spacing tokens", "radius tokens", "shadow tokens", "motion duration/easing tokens"],
      verify: ["custom properties remain present", "token names are generic and source-safe", "contrast and motion tokens pass QA"]
    },
    "classical-cascade": {
      rules: [
        "Keep cascade order, selector layering, and specificity intentional; variants should not add uncontrolled !important overrides.",
        "Vary layout sections and visual tone by editing stylesheet layers with a clear specificity budget."
      ],
      locked: ["cascade layering contract", "selector specificity budget", "stylesheet order"],
      may_vary: ["section composition", "palette declarations", "typographic scale", "spacing rhythm"],
      verify: ["specificity does not spike", "important usage remains rare", "visual diff catches cascade regressions"]
    }
  };
  const selected = byArchetype[primary];
  return {
    schema: "rizzfizz.design-archetype-variant-guidance.v1",
    primary_archetype: primary,
    confidence: classification.primary.probability,
    safe_variation_rules: unique([...selected.rules, ...baseRules]),
    variant_constraints: {
      locked: selected.locked,
      may_vary: selected.may_vary,
      verify: selected.verify
    },
    do_not_clone: [
      "Do not copy source class names, IDs, data attributes, generated class hashes, or component filenames.",
      "Do not copy source URLs, asset paths, build IDs, script chunks, plugin/theme structure, analytics tags, or deployment fingerprints.",
      "Do not copy exact animation timing, easing curves, scroll choreography, keyframe names, or screenshot composition; preserve only abstract motion feel and accessibility constraints."
    ]
  };
}

export function classifyDesignSystem(input: {
  text: string;
  paletteRun?: PaletteRun;
  relationship?: string;
}): DesignSystemClassification {
  const text = input.text || "";
  const relationship = input.relationship || input.paletteRun?.relationship || "";
  const scores = PROFILES.map((profile) => scoreProfile(profile, text, relationship)).sort((a, b) => b.score - a.score);
  const primary = scores[0] || scoreProfile(PROFILES[0], text, relationship);
  const secondary = scores[1] && scores[1].score >= Math.max(3, primary.score * 0.64)
    ? toMatch(scores[1], confidenceForScore(scores[1].score))
    : null;
  const matchedQualities = qualityLabels(primary.matched_categories, secondary?.id ? scores[1]?.matched_categories || [] : []);
  return {
    schema: "rizzfizz.design-system-classification.v1",
    primary: toMatch(primary, confidenceForScore(primary.score)),
    secondary,
    matched_qualities: matchedQualities.length ? matchedQualities : ["palette relationship", "general source-safe layout direction"],
    source_safe_evidence: abstractEvidence(primary.matched_terms, matchedQualities)
  };
}

/**
 * Rank all five umbrella design systems with softmax probabilities (sum ≈ 1).
 * Brand/product systems are never returned here — only the umbrellas in PROFILES.
 */
export function rankDesignSystems(input: {
  text?: string;
  paletteRun?: PaletteRun;
  relationship?: string;
}): DesignSystemStyleMatch[] {
  const text = input.text || "";
  const relationship = input.relationship || input.paletteRun?.relationship || "";
  const scored = PROFILES.map((profile) => scoreProfile(profile, text, relationship));
  const maxScore = Math.max(...scored.map((s) => s.score), 0.01);
  const exps = scored.map((s) => Math.exp((s.score / Math.max(maxScore, 0.5)) * 2.2));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return scored
    .map((s, i) => {
      const probability = Number((exps[i] / sum).toFixed(4));
      return toMatch(s, {
        confidence: probability,
        confidence_label: probability >= 0.45 ? "high" : probability >= 0.22 ? "medium" : "low"
      });
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export function designSystemGuidance(classification: {
  primary: { builder_guidance: string[] };
  secondary: { builder_guidance: string[] } | null;
}): string[] {
  return unique([
    ...classification.primary.builder_guidance,
    ...(classification.secondary?.builder_guidance.slice(0, 1) || [])
  ]);
}

function scoreProfile(profile: InternalProfile, text: string, relationship: string): {
  profile: InternalProfile;
  score: number;
  matched_terms: string[];
  matched_categories: string[];
} {
  const haystack = normalizeText(`${text} ${relationship}`);
  const matchedTerms: string[] = [];
  const matchedCategories: string[] = [];
  let score = 0;

  for (const [category, keywords] of Object.entries(profile.keywords) as Array<[keyof WeightedKeywords, string[]]>) {
    let categoryHits = 0;
    for (const keyword of keywords) {
      if (containsKeyword(haystack, keyword)) {
        categoryHits += 1;
        matchedTerms.push(keyword);
      }
    }
    if (categoryHits > 0) {
      matchedCategories.push(category);
      score += CATEGORY_WEIGHTS[category] * Math.min(3, categoryHits);
    }
  }

  if (relationship && profile.palette_relationships.includes(relationship)) {
    score += 1.2;
    matchedTerms.push(relationship);
    matchedCategories.push("palette");
  }

  return { profile, score: Number(score.toFixed(2)), matched_terms: unique(matchedTerms), matched_categories: unique(matchedCategories) };
}

function toMatch(
  scored: { profile: InternalProfile; score: number },
  confidence: { confidence: number; confidence_label: DesignSystemStyleMatch["confidence_label"] }
): DesignSystemStyleMatch {
  const { keywords, palette_relationships, ...profile } = scored.profile;
  void keywords;
  void palette_relationships;
  return {
    id: profile.id,
    name: profile.name,
    summary: profile.summary,
    score: scored.score,
    confidence: confidence.confidence,
    confidence_label: confidence.confidence_label,
    qualities: profile.qualities,
    builder_guidance: profile.builder_guidance
  };
}

function confidenceForScore(score: number): Pick<DesignSystemStyleMatch, "confidence" | "confidence_label"> {
  const confidence = Math.max(0.18, Math.min(0.98, score / 14));
  return {
    confidence: Number(confidence.toFixed(2)),
    confidence_label: confidence >= 0.72 ? "high" : confidence >= 0.42 ? "medium" : "low"
  };
}

function qualityLabels(primary: string[], secondary: string[]): string[] {
  const labels: Record<string, string> = {
    grid: "grid behavior",
    density: "density",
    hierarchy: "hierarchy",
    typography: "typography",
    ornamentation: "ornamentation",
    entropy: "visual entropy",
    interaction: "interaction feel",
    tokens: "token usage",
    palette: "palette relationship"
  };
  return unique([...primary, ...secondary].map((category) => labels[category] || category));
}

function abstractEvidence(matchedTerms: string[], qualityCats: string[]): string[] {
  // matched_terms are taxonomy keywords / palette relationships only (never free-form source nouns).
  const termLabels = matchedTerms.filter((term) => term.length > 2).slice(0, 8).map((term) => `term:${term}`);
  const qualityLabels = qualityCats.slice(0, 5).map((category) => `quality:${category}`);
  return unique([...termLabels, ...qualityLabels]).slice(0, 12);
}

function toArchetypeMatch(
  scored: { archetype: DesignArchetypeCentroid; distance: number },
  probability: number
): DesignArchetypeMatch {
  return {
    id: scored.archetype.id,
    name: scored.archetype.name,
    summary: scored.archetype.summary,
    probability,
    distance: roundFeature(scored.distance)
  };
}

function normalizeArchetypeFeatures(features: DesignArchetypeFeatures): DesignArchetypeFeatures {
  return {
    ...features,
    custom_property_count: clamp(features.custom_property_count / 8, 0, 1),
    avg_specificity: clamp(features.avg_specificity, 0, 1),
    nesting_depth_avg: clamp(features.nesting_depth_avg / 3, 0, 1),
    important_ratio: clamp(features.important_ratio, 0, 1)
  };
}

function euclideanDistance(a: DesignArchetypeFeatures, b: DesignArchetypeFeatures): number {
  const sumSquares = FEATURE_KEYS.reduce((sum, key) => sum + ((a[key] - b[key]) ** 2), 0);
  return Math.sqrt(sumSquares / FEATURE_KEYS.length);
}

function softmaxProbabilities(values: number[]): number[] {
  const maxValue = Math.max(...values);
  const exponents = values.map((value) => Math.exp(value - maxValue));
  const sum = exponents.reduce((total, value) => total + value, 0) || 1;
  const rounded = exponents.map((value) => Number((value / sum).toFixed(6)));
  const drift = Number((1 - rounded.reduce((total, value) => total + value, 0)).toFixed(6));
  rounded[0] = Number((rounded[0] + drift).toFixed(6));
  return rounded;
}

function extractClassNames(markup: string): string[] {
  const classes: string[] = [];
  for (const match of markup.matchAll(/\bclass(?:Name)?\s*=\s*(["'`])([\s\S]*?)\1/g)) {
    classes.push(...match[2].split(/\s+/).map((name) => name.trim()).filter(Boolean));
  }
  return classes;
}

function isUtilityClass(className: string): boolean {
  const normalized = className.replace(/^[a-z-]+:/i, "");
  return /^(?:-?m[trblxy]?|p[trblxy]?|gap|space-[xy]|grid|flex|block|inline|hidden|items|justify|content|self|place|col|row|w|h|min-w|max-w|min-h|max-h|text|font|leading|tracking|bg|from|via|to|border|rounded|shadow|opacity|z|top|right|bottom|left|inset|translate|scale|rotate|duration|ease|hover|focus|sr-only)(?:-|$)/.test(normalized)
    || /^(?:flex|grid|block|inline-block|inline-flex|hidden|relative|absolute|fixed|sticky|container|sr-only)$/.test(normalized);
}

function isBemClass(className: string): boolean {
  return /__[A-Za-z0-9_-]+|--[A-Za-z0-9_-]+/.test(className);
}

function isHashLikeClass(className: string): boolean {
  return /(?:^|[-_])(?:css|sc|jsx|_[a-z]?)[-_]?[a-z0-9]{5,}$/i.test(className)
    || /[a-z][-_][a-z0-9]{6,}$/i.test(className);
}

function extractCssSelectors(css: string): string[] {
  return [...css.matchAll(/([^{};]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((selector) => selector && !selector.startsWith("@") && !/[=:]\s*$/.test(selector));
}

function selectorSpecificity(selector: string): number {
  const idCount = (selector.match(/#[A-Za-z0-9_-]+/g) || []).length;
  const classAttrPseudoCount = (selector.match(/\.[A-Za-z0-9_-]+|\[[^\]]+\]|:(?!:)[A-Za-z0-9_-]+/g) || []).length;
  const elementCount = selector
    .replace(/#[A-Za-z0-9_-]+|\.[A-Za-z0-9_-]+|\[[^\]]+\]|:{1,2}[A-Za-z0-9_-]+/g, " ")
    .split(/[\s>+~,]+/)
    .filter((part) => /^[A-Za-z][A-Za-z0-9-]*$/.test(part)).length;
  return Number(((idCount * 1) + (classAttrPseudoCount * 0.1) + (elementCount * 0.01)).toFixed(3));
}

function countCssDeclarations(css: string): number {
  return (css.match(/[A-Za-z-]+\s*:[^;{}]+[;}]/g) || []).length;
}

function averageNestingDepth(css: string): number {
  let depth = 0;
  const depths: number[] = [];
  for (const char of css) {
    if (char === "{") {
      depth += 1;
      depths.push(Math.max(0, depth - 1));
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  const ampersandNesting = (css.match(/&\s*[.#[:]/g) || []).length;
  return depths.length ? average(depths) + (ampersandNesting * 0.5) : 0;
}

function dataOrStyleElementRatio(markup: string): number {
  const elementCount = Math.max(1, (markup.match(/<[A-Za-z][^>]*>/g) || []).length);
  const styledElementCount = (markup.match(/<[A-Za-z][^>]*(?:\sdata-[\w-]+\s*=|\sstyle\s*=)[^>]*>/g) || []).length;
  return styledElementCount / elementCount;
}

function detectsCssInJs(value: string): boolean {
  return /\b(?:styled\.[A-Za-z]+|css\s*`|stylex\.|vanilla-extract|emotion|linaria|compiled-css|createUseStyles)\b/.test(value);
}

function detectsShadowDom(value: string): boolean {
  return /\battachShadow\s*\(|\bshadowRoot\b|<template\s+shadowroot(?:mode)?=|<[a-z]+-[a-z0-9-]+\b/i.test(value);
}

function countUniqueMatches(value: string, pattern: RegExp): number {
  return new Set([...value.matchAll(pattern)].map((match) => match[1])).size;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundFeature(value: number): number {
  return Number(value.toFixed(6));
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const normalized = normalizeText(keyword);
  if (!normalized) return false;
  return haystack.includes(normalized);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
