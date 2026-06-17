export type PaletteTokens = {
  paper: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  accent_strong: string;
  line: string;
};

export type ContrastCheck = {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  level: "pass" | "warn" | "fail";
  threshold: number;
  required: boolean;
};

export type PaletteRelationship = {
  tone: "dark" | "light" | "neutral";
  accent_usage: "sparse" | "moderate" | "expressive";
  chroma: string;
  contrast: string;
  relationship: string;
};

export type PaletteVariant = {
  id: string;
  name: string;
  strategy: string;
  hue_family: string;
  hue: number;
  tokens: PaletteTokens;
  palette_relationship: PaletteRelationship;
  palette_usage: string;
  checks: {
    contrast: ContrastCheck[];
    warnings: string[];
    failures: string[];
  };
};

export type PaletteRun = {
  schema: "rizzfizz.palette-run.v1";
  created_at: string;
  relationship: string;
  hue_family: string;
  source: string;
  variants: PaletteVariant[];
};

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

export type DesignSystemStyleMatch = {
  id: string;
  name: string;
  summary: string;
  confidence: number;
  confidence_label: "low" | "medium" | "high";
  score: number;
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

export type RawReference = {
  schema: "rizzfizz.raw-reference.v1";
  source_type: "design-md";
  source_locator: string;
  captured_at: string;
  private_notes: string;
  raw_text: string;
  extracted: {
    urls: string[];
    hex_colors: string[];
    possible_fonts: string[];
    possible_identity_terms: string[];
  };
  provenance: Record<string, unknown>;
};

export type PageIntent = {
  site_type: string;
  primary_job: string;
  secondary_jobs: string[];
  audience: string;
  content_posture: string;
};

export type LayoutContract = {
  first_viewport: string;
  navigation: string;
  regions: Array<{
    id: string;
    purpose: string;
    density: string;
    notes: string[];
  }>;
  responsive_rules: string[];
};

export type ComponentContract = {
  required: Array<{
    name: string;
    purpose: string;
    states: string[];
    constraints: string[];
  }>;
  optional: string[];
};

export type MotionContract = {
  level: "none" | "subtle" | "expressive" | "immersive";
  allowed_techniques: string[];
  patterns: Array<{
    name: string;
    trigger: string;
    duration_ms: [number, number];
    easing: string;
    constraints: string[];
  }>;
  reduced_motion: string;
  performance_budget: string[];
};

export type VisualQaContract = {
  screenshots: string[];
  checks: string[];
  fail_if: string[];
};

export type BuildContractVariant = {
  id: string;
  name: string;
  palette_tokens: PaletteTokens;
  palette_relationship: PaletteRelationship;
  palette_usage: string;
  technology_direction: Record<string, unknown>;
  visual_rules: string[];
};

export type DesignScoreVariantGuidance = {
  source: "design-score-report";
  report_card: {
    score: number;
    grade: string;
    summary: string;
  };
  palette_constraints: string[];
  archetype_constraints: {
    locked: string[];
    may_vary: string[];
    verify: string[];
  };
  combined_guidance: string[];
  qa_checks: string[];
  do_not_clone: string[];
};

export type BuildContract = {
  schema: "rizzfizz.build-contract.v1";
  created_at: string;
  source_safe: true;
  source_reference_ids: string[];
  entrypoint: string;
  design_system_classification: DesignSystemClassification;
  intent: PageIntent;
  layout: LayoutContract;
  components: ComponentContract;
  motion: MotionContract;
  visual_qa: VisualQaContract;
  avoid: string[];
  variants: BuildContractVariant[];
};

export type VisualTokensVariant = {
  id: string;
  surfaces: {
    canvas: string;
    surface: string;
    surface_raised: string;
    surface_sunken: string;
    overlay: string;
  };
  text: {
    text_primary: string;
    text_secondary: string;
    text_inverse: string;
  };
  actions: {
    action: string;
    action_hover: string;
    action_pressed: string;
    focus_ring: string;
  };
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  data_viz: {
    categorical: string[];
    sequential: string[];
    neutral_grid: string;
  };
  effects: {
    shadow_color: string;
    glow_color: string;
    gradient_from: string;
    gradient_to: string;
  };
  usage_rules: string[];
  checks: ContrastCheck[];
};

export type VisualTokensRun = {
  schema: "rizzfizz.visual-tokens.v1";
  created_at: string;
  source_palette_run: string;
  variants: VisualTokensVariant[];
};

export type RunManifest = {
  schema: "rizzfizz.run-manifest.v1";
  created_at: string;
  source_safe_entrypoints: {
    build_contract: string;
    visual_tokens: string;
    palette_run: string;
    variants_palette: string;
    variants_json: string;
    preview_html: string;
    tokens_css: string;
    builder_briefs: string;
  };
  private_artifacts: {
    raw_reference: string;
  };
  optional_artifacts: {
    technology_context: string | null;
    design_score: string | null;
  };
  recommended_start: string;
  variants: Array<{
    id: string;
    name: string;
    builder_brief: string;
    design_md: string;
  }>;
};

export type AEyesIntakeVariants = {
  master_brief: {
    title: string;
    raw_idea_summary: string;
    target_user: string;
    site_goal: string;
    must_include: string[];
    must_avoid: string[];
    content_notes: string[];
    motion_intent: string;
    success_criteria: string[];
  };
  shared_constraints: {
    viewport_targets: string[];
    accessibility_notes: string[];
    technical_constraints: string[];
    a_eyes_required: true;
  };
  variants: Array<{
    id: string;
    name: string;
    design_direction: string;
    layout_strategy: string;
    palette_direction: string;
    palette_relationship: PaletteRelationship;
    palette_tokens: PaletteTokens;
    palette_usage: string;
    typography_direction: string;
    technology_direction: Record<string, unknown>;
    motion_direction: string;
    hero_or_primary_view: string;
    sections: string[];
    specific_requirements: string[];
    risk_notes: string[];
    design_score_guidance?: DesignScoreVariantGuidance;
  }>;
};
