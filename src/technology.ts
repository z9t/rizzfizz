import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { readJson } from "./io.js";

const execFileAsync = promisify(execFile);

export type WaffleEvidence = {
  channel?: string;
  confidence?: number;
  pattern?: string;
  value?: string;
  version?: string;
  url?: string;
  status?: number;
};

export type WaffleTechnology = {
  name: string;
  confidence: number;
  versions: string[];
  categories: string[];
  website?: string;
  evidence: WaffleEvidence[];
};

export type WaffleScan = {
  url: string;
  status: number;
  technologies: WaffleTechnology[];
  features: Record<string, number>;
  aggressive: boolean;
};

export const waffleScanSchema = {
  parse(value: unknown): WaffleScan {
    const object = expectRecord(value, "whiffler scan");
    return {
      url: expectString(object.url, "url"),
      status: expectNumber(object.status, "status"),
      technologies: optionalArray(object.technologies).map(parseTechnology),
      features: parseNumberRecord(object.features),
      aggressive: typeof object.aggressive === "boolean" ? object.aggressive : false
    };
  }
};

export type TechnologyContext = {
  schema: "rizzfizz.technology-context.v1";
  source: "whiffler";
  created_at: string;
  raw_scan: WaffleScan;
  detected: Array<{
    name: string;
    confidence: number;
    categories: string[];
    versions: string[];
    evidence_channels: string[];
  }>;
  recommendations: {
    detected_stack_summary: string;
    builder_use: string[];
    cautions: string[];
    stack_fit: string;
  };
};

const DEFAULT_WHIFFLER = "/Users/max/Documents/Code/whiffler/src/cli/whiffler.js";

export async function runWhiffler(options: {
  url: string;
  aggressive?: boolean;
  timeout?: number;
  executable?: string;
}): Promise<WaffleScan> {
  const executable = options.executable || DEFAULT_WHIFFLER;
  await access(executable);
  const args = [executable, "--json"];
  if (options.aggressive) args.push("--aggressive");
  if (options.timeout) args.push("--timeout", String(options.timeout));
  args.push(options.url);
  const { stdout } = await execFileAsync("node", args, {
    maxBuffer: 1024 * 1024 * 10
  });
  return waffleScanSchema.parse(JSON.parse(stdout));
}

export async function readWhifflerScan(path: string): Promise<WaffleScan> {
  return waffleScanSchema.parse(await readJson(path));
}

export function buildTechnologyContext(scan: WaffleScan): TechnologyContext {
  const detected = scan.technologies
    .filter((tech) => tech.confidence >= 30)
    .slice(0, 30)
    .map((tech) => ({
      name: tech.name,
      confidence: tech.confidence,
      categories: tech.categories,
      versions: tech.versions,
      evidence_channels: [...new Set(tech.evidence.map((item) => item.channel).filter((item): item is string => Boolean(item)))]
    }));

  return {
    schema: "rizzfizz.technology-context.v1",
    source: "whiffler",
    created_at: new Date().toISOString(),
    raw_scan: scan,
    detected,
    recommendations: recommendFromDetected(detected, scan.features)
  };
}

function recommendFromDetected(
  detected: TechnologyContext["detected"],
  features: Record<string, number>
): TechnologyContext["recommendations"] {
  const names = detected.map((item) => item.name.toLowerCase());
  const categories = new Set(detected.flatMap((item) => item.categories.map((cat) => cat.toLowerCase())));
  const summary = detected.length
    ? detected.slice(0, 8).map((item) => `${item.name} ${item.confidence}%`).join(", ")
    : "No confident technologies detected.";
  const builderUse = [
    "Use detected technologies as source-context evidence, not as a mandatory implementation stack.",
    "Prefer the RizzFizz stack recommendation when it conflicts with a legacy or platform-specific detected stack.",
    "Preserve raw Whiffler evidence separately from builder-facing clone-safe guidance."
  ];
  const cautions = [
    "Passive fingerprinting can be brittle or misleading on customized/hardened deployments.",
    "Do not infer that detected source technology must be recreated unless the project brief explicitly asks for compatibility."
  ];
  let stackFit = "Use the normal RizzFizz stack selector based on site type.";

  if (hasAny(names, ["next.js", "react", "vite", "astro", "svelte", "vue.js"])) {
    stackFit = "Modern frontend framework signals detected; a React/Next, Astro, Vite, Vue, or Svelte build may be appropriate if it matches the target site type.";
  }
  if (hasAny(names, ["wordpress", "shopify", "webflow", "squarespace", "wix"]) || categories.has("cms") || categories.has("ecommerce")) {
    stackFit = "CMS/ecommerce/platform signals detected; for agent builds, recreate the usable frontend experience rather than the source platform unless backend/CMS parity is explicitly in scope.";
  }
  if (hasAny(names, ["three.js", "gsap", "pixi.js", "anime.js"]) || categories.has("javascript graphics")) {
    stackFit = "Motion or graphics libraries detected; include GSAP/Three.js only when the generated brief genuinely needs that interaction layer and includes reduced-motion fallback.";
  }
  if (hasAny(names, ["cloudflare", "nginx", "apache", "varnish", "fastly"]) || categories.has("cdn") || categories.has("web servers")) {
    builderUse.push("Infrastructure/CDN/server detections should inform deployment assumptions only; they should not shape visual implementation by themselves.");
  }
  if ((features.script_count || 0) === 0) {
    cautions.push("The scanned page has no detected scripts, so frontend framework absence may reflect a static page, blocked resources, or limited scan depth.");
  }

  return {
    detected_stack_summary: summary,
    builder_use: builderUse,
    cautions,
    stack_fit: stackFit
  };
}

function hasAny(values: string[], needles: string[]): boolean {
  return needles.some((needle) => values.some((value) => value.includes(needle)));
}

function parseTechnology(value: unknown): WaffleTechnology {
  const object = expectRecord(value, "technology");
  return {
    name: expectString(object.name, "technology.name"),
    confidence: expectNumber(object.confidence, "technology.confidence"),
    versions: optionalArray(object.versions).map((item) => expectString(item, "technology.version")),
    categories: optionalArray(object.categories).map((item) => expectString(item, "technology.category")),
    website: typeof object.website === "string" ? object.website : undefined,
    evidence: optionalArray(object.evidence).map(parseEvidence)
  };
}

function parseEvidence(value: unknown): WaffleEvidence {
  const object = expectRecord(value, "evidence");
  return {
    channel: optionalString(object.channel),
    confidence: optionalNumber(object.confidence),
    pattern: optionalString(object.pattern),
    value: optionalString(object.value),
    version: optionalString(object.version),
    url: optionalString(object.url),
    status: optionalNumber(object.status)
  };
}

function parseNumberRecord(value: unknown): Record<string, number> {
  if (value === undefined) return {};
  const object = expectRecord(value, "features");
  return Object.fromEntries(
    Object.entries(object).filter((entry): entry is [string, number] => typeof entry[1] === "number" && !Number.isNaN(entry[1]))
  );
}

function optionalArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`${label} must be a number`);
  return value;
}
