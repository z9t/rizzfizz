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
  schema: "rizzfizz.technology-context.v2";
  source: "whiffler";
  created_at: string;
  source_safe: true;
  scan: {
    url: "redacted";
    status: number;
    aggressive: boolean;
    features: Record<string, number>;
  };
  detected: Array<{
    name: string;
    confidence: number;
    confidence_label: "high" | "medium" | "low";
    categories: string[];
    versions: string[];
    evidence_channels: string[];
    strongest_evidence: TechnologyEvidenceSummary[];
  }>;
  weak_signals: Array<{
    name: string;
    confidence: number;
    categories: string[];
    strongest_evidence: TechnologyEvidenceSummary[];
  }>;
  recommendations: {
    detected_stack_summary: string;
    builder_use: string[];
    cautions: string[];
    stack_fit: string;
    do_not_clone: string[];
  };
};

export type TechnologyEvidenceSummary = {
  channel: string;
  confidence: number;
  pattern?: string;
  value_kind?: string;
  version?: string;
  status?: number;
};

const LEGACY_WHIFFLER = "/Users/max/Documents/Code/whiffler/src/cli/whiffler.js";
const DETECTED_CONFIDENCE_THRESHOLD = 30;
const STRONG_EVIDENCE_LIMIT = 3;

export function assertHttpUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`tech URL must be http(s), got invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`tech URL must be http(s), got ${parsed.protocol}`);
  }
  return url;
}

export async function resolveWhifflerExecutable(explicit?: string): Promise<string> {
  if (explicit) {
    await access(explicit);
    return explicit;
  }
  const env = (process as unknown as { env?: Record<string, string | undefined> }).env || {};
  const fromEnv = env.RIFF_WHIF_BIN || env.WHIFFLER_BIN;
  if (fromEnv) {
    await access(fromEnv);
    return fromEnv;
  }
  try {
    await access(LEGACY_WHIFFLER);
    return LEGACY_WHIFFLER;
  } catch {
    throw new Error(
      "Whiffler CLI not found. Pass --whiffler <path-to-whiffler.js> or set RIFF_WHIF_BIN to the Whiffler JS entrypoint."
    );
  }
}

export async function runWhiffler(options: {
  url: string;
  aggressive?: boolean;
  timeout?: number;
  executable?: string;
}): Promise<WaffleScan> {
  assertHttpUrl(options.url);
  const executable = await resolveWhifflerExecutable(options.executable);
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
    .filter((tech) => tech.confidence >= DETECTED_CONFIDENCE_THRESHOLD)
    .slice(0, 30)
    .map((tech) => ({
      name: tech.name,
      confidence: tech.confidence,
      confidence_label: confidenceLabel(tech.confidence),
      categories: tech.categories,
      versions: tech.versions,
      evidence_channels: evidenceChannels(tech),
      strongest_evidence: strongestEvidence(tech)
    }));
  const weakSignals = scan.technologies
    .filter((tech) => tech.confidence > 0 && tech.confidence < DETECTED_CONFIDENCE_THRESHOLD)
    .slice(0, 10)
    .map((tech) => ({
      name: tech.name,
      confidence: tech.confidence,
      categories: tech.categories,
      strongest_evidence: strongestEvidence(tech)
    }));

  return {
    schema: "rizzfizz.technology-context.v2",
    source: "whiffler",
    created_at: new Date().toISOString(),
    source_safe: true,
    scan: {
      url: "redacted",
      status: scan.status,
      aggressive: scan.aggressive,
      features: scan.features
    },
    detected,
    weak_signals: weakSignals,
    recommendations: recommendFromDetected(detected, weakSignals, scan.features)
  };
}

function recommendFromDetected(
  detected: TechnologyContext["detected"],
  weakSignals: TechnologyContext["weak_signals"],
  features: Record<string, number>
): TechnologyContext["recommendations"] {
  const names = detected.map((item) => item.name.toLowerCase());
  const categories = new Set(detected.flatMap((item) => item.categories.map((cat) => cat.toLowerCase())));
  const summary = detected.length
    ? detected.slice(0, 8).map((item) => `${item.name} ${item.confidence}% via ${item.evidence_channels.join("/") || "unknown evidence"}`).join(", ")
    : "No confident technologies detected.";
  const builderUse = [
    "Use detected technologies as source-context evidence, not as a mandatory implementation stack.",
    "Prefer the RizzFizz stack recommendation when it conflicts with a legacy or platform-specific detected stack.",
    "Use confidence and evidence channels to decide whether a stack signal is strong enough to influence the build."
  ];
  const cautions = [
    "Passive fingerprinting can be brittle or misleading on customized/hardened deployments.",
    "Do not infer that detected source technology must be recreated unless the project brief explicitly asks for compatibility."
  ];
  const doNotClone = [
    "Do not copy source URLs, file paths, headers, cookies, class names, or tracking snippets.",
    "Do not clone a source CMS, ecommerce platform, hosting provider, CDN, or server stack unless backend parity is explicitly in scope.",
    "Do not reproduce source plugin/theme structure, generated asset paths, analytics tags, or deployment fingerprints."
  ];
  let stackFit = "Use the normal RizzFizz stack selector based on site type.";

  if (hasAny(names, ["next.js", "react", "vite", "astro", "svelte", "vue.js"])) {
    stackFit = "Modern frontend framework signals detected; a React/Next, Astro, Vite, Vue, or Svelte build may be appropriate when it matches the target site type and the strongest evidence is not only incidental page text.";
    builderUse.push("When a framework has high-confidence script or HTML evidence, it can support choosing the matching builder stack for similar interactivity.");
    doNotClone.push("Do not copy generated framework asset paths such as chunk URLs or build IDs.");
  }
  if (hasAny(names, ["wordpress", "shopify", "webflow", "squarespace", "wix"]) || categories.has("cms") || categories.has("ecommerce")) {
    stackFit = "CMS/ecommerce/platform signals detected; for agent builds, recreate the usable frontend experience rather than the source platform unless backend/CMS parity is explicitly in scope.";
    doNotClone.push("Do not copy CMS themes, storefront templates, plugin lists, collection structures, or checkout implementation details.");
  }
  if (hasAny(names, ["three.js", "gsap", "pixi.js", "anime.js"]) || categories.has("javascript graphics")) {
    stackFit = "Motion or graphics libraries detected; include GSAP/Three.js only when the generated brief genuinely needs that interaction layer and includes reduced-motion fallback.";
    builderUse.push("Treat motion-library evidence as permission to consider a similar interaction layer, not as a requirement to match the source animation system.");
    doNotClone.push("Do not clone exact animation timing, scroll choreography, shader code, or canvas scene structure from the source.");
  }
  if (hasAny(names, ["cloudflare", "nginx", "apache", "varnish", "fastly"]) || categories.has("cdn") || categories.has("web servers")) {
    builderUse.push("Infrastructure/CDN/server detections should inform deployment assumptions only; they should not shape visual implementation by themselves.");
    doNotClone.push("Do not treat CDN, cache, server, or security headers as frontend implementation requirements.");
  }
  if ((features.script_count || 0) === 0) {
    cautions.push("The scanned page has no detected scripts, so frontend framework absence may reflect a static page, blocked resources, or limited scan depth.");
  }
  if (weakSignals.length > 0) {
    cautions.push(`Weak unpromoted signals were present: ${weakSignals.map((item) => `${item.name} ${item.confidence}%`).join(", ")}.`);
  }

  return {
    detected_stack_summary: summary,
    builder_use: builderUse,
    cautions,
    stack_fit: stackFit,
    do_not_clone: unique(doNotClone)
  };
}

function strongestEvidence(tech: WaffleTechnology): TechnologyEvidenceSummary[] {
  return [...tech.evidence]
    .sort((left, right) => (right.confidence || 0) - (left.confidence || 0))
    .slice(0, STRONG_EVIDENCE_LIMIT)
    .map((item) => ({
      channel: item.channel || "unknown",
      confidence: item.confidence || 0,
      pattern: sourceSafeSnippet(item.pattern),
      value_kind: classifyEvidenceValue(item.value, item.channel),
      version: sourceSafeSnippet(item.version),
      status: item.status
    }));
}

function evidenceChannels(tech: WaffleTechnology): string[] {
  return [...new Set(tech.evidence.map((item) => item.channel || "unknown"))];
}

function confidenceLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 80) return "high";
  if (confidence >= 50) return "medium";
  return "low";
}

function classifyEvidenceValue(value: string | undefined, channel: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return "url";
  if (/cookie/i.test(channel || "")) return "cookie";
  if (/header/i.test(channel || "") || /^[a-z0-9-]+\s*:/i.test(value)) return "header";
  if (/<[a-z][\s\S]*>/i.test(value)) return "html";
  if (/\.(?:js|mjs|css)(?:\?|$)/i.test(value)) return "asset-reference";
  return "text";
}

function sourceSafeSnippet(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const redacted = value
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
  return redacted.length > 120 ? `${redacted.slice(0, 117)}...` : redacted;
}

function hasAny(values: string[], needles: string[]): boolean {
  return needles.some((needle) => values.some((value) => value.includes(needle)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function parseTechnology(value: unknown): WaffleTechnology {
  const object = expectRecord(value, "technology");
  const name = firstString(object.name, object.normalized_name, object.normalizedName, object.displayName, object.label, object.id);
  if (!name) throw new Error("technology.name must be a string");
  return {
    name,
    confidence: normalizeConfidence(firstNumber(object.confidence, object.confidence_score, object.score, object.probability) ?? 0),
    versions: normalizeStringList(object.versions ?? object.version, "technology.version"),
    categories: normalizeCategories(object.categories ?? object.category),
    website: typeof object.website === "string" ? object.website : undefined,
    evidence: normalizeEvidenceList(object.evidence ?? object.evidences ?? object.signals)
  };
}

function parseEvidence(value: unknown): WaffleEvidence {
  const object = expectRecord(value, "evidence");
  return {
    channel: optionalString(object.channel) || optionalString(object.type) || optionalString(object.kind),
    confidence: optionalNumber(object.confidence) ?? optionalNumber(object.score),
    pattern: optionalString(object.pattern) || optionalString(object.detector),
    value: optionalString(object.value) || optionalString(object.match) || optionalString(object.snippet),
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

function normalizeConfidence(value: number): number {
  const normalized = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Number(normalized.toFixed(2))));
}

function normalizeStringList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => expectString(item, label));
}

function normalizeCategories(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => {
    if (typeof item === "string") return item;
    const object = expectRecord(item, "technology.category");
    const name = firstString(object.name, object.label, object.id, object.slug);
    if (!name) throw new Error("technology.category must be a string");
    return name;
  });
}

function normalizeEvidenceList(value: unknown): WaffleEvidence[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map(parseEvidence);
  const object = expectRecord(value, "evidence");
  return Object.entries(object).flatMap(([channel, entries]) => {
    const values = Array.isArray(entries) ? entries : [entries];
    return values.map((entry) => {
      const evidence = parseEvidence(entry);
      return { ...evidence, channel: evidence.channel || channel };
    });
  });
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === "number" && !Number.isNaN(value));
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
