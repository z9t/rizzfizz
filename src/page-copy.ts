/**
 * Structured page copy for studio preview + prompt examples.
 * Source: pulled HTML, CLI --body/--footer, or manual studio edits.
 */

export type PageCopy = {
  schema: "rizzfizz.page-copy.v1";
  source_url?: string;
  title?: string;
  eyebrow?: string;
  site_name?: string;
  sub?: string;
  h2?: string;
  body?: string;
  footer?: string;
  cta_primary?: string;
  cta_secondary?: string;
  paragraphs: string[];
  /** True when body/footer were set via CLI or studio edit for use in agent prompts. */
  prompt_example?: boolean;
};

const DEFAULT_BODY =
  "Spacing, type roles, and colour relationships from the selected variant. Inspired-by is source-safe when present; otherwise INSP-VALUE.";
const DEFAULT_SUB = "One composition. Brand first. Tokens live.";
const DEFAULT_H2 = "System in use";
const DEFAULT_EYEBROW = "Design preview";
const DEFAULT_FOOTER = "INSP-VALUE";

export function defaultPageCopy(partial: Partial<PageCopy> = {}): PageCopy {
  return {
    eyebrow: DEFAULT_EYEBROW,
    sub: DEFAULT_SUB,
    h2: DEFAULT_H2,
    body: DEFAULT_BODY,
    footer: DEFAULT_FOOTER,
    cta_primary: "Primary action",
    cta_secondary: "Secondary",
    ...partial,
    schema: "rizzfizz.page-copy.v1",
    paragraphs: partial.paragraphs || []
  };
}

/** Extract readable sections from HTML for studio / prompts. */
export function extractPageCopy(html: string, sourceUrl?: string): PageCopy {
  const title = matchTag(html, "title");
  const h1 = matchTag(html, "h1");
  const h2 = matchTag(html, "h2");
  const metaDesc = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  )?.[1]?.trim()
    || html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
    )?.[1]?.trim();
  const footerRaw = matchTag(html, "footer");
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 40);
  const body = paragraphs.slice(0, 4).join("\n\n")
    || stripTags(html).replace(/\s+/g, " ").trim().slice(0, 800);
  const siteName = h1 || title || undefined;
  const sub = metaDesc || paragraphs[0]?.slice(0, 160) || undefined;
  const footer = footerRaw
    ? footerRaw.replace(/\s+/g, " ").trim().slice(0, 240)
    : undefined;

  return defaultPageCopy({
    source_url: sourceUrl,
    title,
    site_name: siteName,
    eyebrow: title && siteName && title !== siteName ? title : DEFAULT_EYEBROW,
    sub: sub || DEFAULT_SUB,
    h2: h2 || DEFAULT_H2,
    body: body || DEFAULT_BODY,
    footer: footer || DEFAULT_FOOTER,
    paragraphs
  });
}

export function mergePageCopy(
  base: PageCopy,
  override: Partial<PageCopy> & { body?: string; footer?: string }
): PageCopy {
  const next = { ...base, ...override, schema: "rizzfizz.page-copy.v1" as const };
  if (override.body || override.footer) next.prompt_example = true;
  if (override.paragraphs) next.paragraphs = override.paragraphs;
  return next;
}

/** Prompt-facing snippet: body + footer as examples agents can paste. */
export function promptCopyPayload(copy: PageCopy): {
  schema: "rizzfizz.prompt-copy.v1";
  body: string;
  footer: string;
  site_name?: string;
  insp?: string;
  usage: string;
} {
  return {
    schema: "rizzfizz.prompt-copy.v1",
    body: copy.body || DEFAULT_BODY,
    footer: copy.footer || DEFAULT_FOOTER,
    site_name: copy.site_name,
    insp: copy.source_url,
    usage: "example_body_and_footer_for_prompts — paste into builder briefs; edit in studio with pen icons"
  };
}

function matchTag(html: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  if (!m) return undefined;
  const text = stripTags(m[1]).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}
