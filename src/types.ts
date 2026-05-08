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
