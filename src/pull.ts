import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { deepPullSite } from "./deep-pull.js";
import { writeJson } from "./io.js";
import { extractPageCopy, type PageCopy } from "./page-copy.js";

export type PullOptions = {
  out: string;
  insp?: string;
  copy?: string;
  img?: string;
  imgCount?: number;
  /** Fetch-only (no escalation). */
  fastCopy?: boolean;
  fastImg?: boolean;
  /** Deep copy crawl: fetch → light paths → wigolo → playwright → scrapy/scrapely. */
  allCopy?: boolean;
  /** Deep image crawl with same escalation ladder. */
  allImg?: boolean;
};

export type PullResult = {
  schema: "rizzfizz.pull.v1";
  created_at: string;
  insp?: { url: string; status: number; title?: string; note: string };
  copy?: {
    url: string;
    status: number;
    text_path: string;
    json_path: string;
    chars: number;
    escalation: string[];
    structured?: PageCopy;
  };
  images?: {
    url: string;
    status: number;
    count: number;
    paths: string[];
    escalation: string[];
    queue?: "sync" | "async";
  };
  notes: string[];
};

/**
 * Pull inspire / copy / images.
 * Default: polite single-page fetch.
 * --allcopy/--allimg: real deep pull (wigolo, a-eyes playwright, scrapy/scrapely).
 */
export async function pullAssets(options: PullOptions): Promise<PullResult> {
  const outDir = resolve(options.out);
  await mkdir(outDir, { recursive: true });
  const notes: string[] = [];
  const result: PullResult = {
    schema: "rizzfizz.pull.v1",
    created_at: new Date().toISOString(),
    notes
  };

  if (options.insp) {
    result.insp = await pullInsp(options.insp);
    notes.push(`insp: ${options.insp} → status ${result.insp.status}`);
  }

  const deep = Boolean(options.allCopy || options.allImg);
  const deepUrl = options.copy || options.img || options.insp;

  if (deep && deepUrl && !options.fastCopy && !options.fastImg) {
    const deepResult = await deepPullSite({
      url: deepUrl,
      outDir,
      wantCopy: Boolean(options.copy || options.allCopy),
      wantImages: Boolean(options.img || options.allImg),
      imgCount: options.imgCount || 3
    });
    notes.push(...deepResult.notes);
    notes.push(`deep-pull escalation: ${deepResult.escalation_used.join(" → ")}`);
    if (options.copy || options.allCopy) {
      result.copy = {
        url: deepUrl,
        status: deepResult.pages[0]?.status || 200,
        text_path: join(outDir, "pulled-copy.txt"),
        json_path: join(outDir, "pulled-copy.json"),
        chars: deepResult.copy.body?.length || 0,
        escalation: deepResult.escalation_used,
        structured: deepResult.copy
      };
    }
    if (options.img || options.allImg) {
      result.images = {
        url: deepUrl,
        status: deepResult.pages[0]?.status || 200,
        count: deepResult.images.length,
        paths: deepResult.images,
        escalation: deepResult.escalation_used,
        queue: "sync"
      };
    }
  } else {
    if (options.copy) {
      const escalation = escalatePlan({ all: false, fast: Boolean(options.fastCopy) });
      result.copy = await pullCopy(options.copy, outDir, escalation);
    }
    if (options.img) {
      const count = Math.max(1, Math.min(24, options.imgCount || 3));
      const escalation = escalatePlan({ all: false, fast: Boolean(options.fastImg) });
      result.images = await pullImages(options.img, outDir, count, escalation);
    }
  }

  if (!options.insp && !options.copy && !options.img && !options.allCopy && !options.allImg) {
    throw new Error("pull requires --insp and/or --copy and/or --img");
  }

  await writeJson(join(outDir, "pull-manifest.json"), result);
  return result;
}

function escalatePlan(options: { all: boolean; fast: boolean }): string[] {
  if (options.fast) return ["fetch"];
  if (options.all) return ["fetch", "wigolo", "playwright(a-eyes)", "scrapely|scrapy"];
  return ["fetch"];
}

const FETCH_MS = Number(process.env.RIZZFIZZ_PULL_TIMEOUT_MS || 8000);

async function pullInsp(url: string): Promise<NonNullable<PullResult["insp"]>> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "RizzFizzPull/0.2 (+local; polite single GET)" },
      signal: AbortSignal.timeout(FETCH_MS)
    });
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return {
      url,
      status: res.status,
      title,
      note: "Static GET — deep styles via --allcopy / a-eyes playwright."
    };
  } catch (error) {
    return {
      url,
      status: 0,
      note: `fetch failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function pullCopy(url: string, outDir: string, escalation: string[]): Promise<NonNullable<PullResult["copy"]>> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "RizzFizzPull/0.2 (+local; polite single GET)" },
    signal: AbortSignal.timeout(FETCH_MS)
  });
  const html = await res.text();
  const structured = extractPageCopy(html, url);
  const text = [
    structured.title,
    structured.site_name,
    structured.sub,
    structured.h2,
    structured.body,
    structured.footer,
    ...structured.paragraphs
  ].filter(Boolean).join("\n\n").slice(0, 200_000) || htmlToText(html).slice(0, 200_000);
  const textPath = join(outDir, "pulled-copy.txt");
  const jsonPath = join(outDir, "pulled-copy.json");
  await writeFile(textPath, text, "utf8");
  await writeJson(jsonPath, structured);
  return {
    url,
    status: res.status,
    text_path: textPath,
    json_path: jsonPath,
    chars: text.length,
    escalation,
    structured
  };
}

async function pullImages(
  url: string,
  outDir: string,
  count: number,
  escalation: string[]
): Promise<NonNullable<PullResult["images"]>> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "RizzFizzPull/0.2 (+local; polite single GET)" },
    signal: AbortSignal.timeout(FETCH_MS)
  });
  const html = await res.text();
  const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => absoluteUrl(url, m[1]))
    .filter((u) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u) || u.startsWith("http"));
  const unique = [...new Set(srcs)].slice(0, count);
  const paths: string[] = [];
  for (let i = 0; i < unique.length; i++) {
    try {
      const imgRes = await fetch(unique[i], {
        headers: { "user-agent": "RizzFizzPull/0.2 (+local; polite image GET)" },
        signal: AbortSignal.timeout(Math.min(FETCH_MS, 8000))
      });
      if (!imgRes.ok) continue;
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      const ext = guessExt(unique[i], imgRes.headers.get("content-type"));
      const path = join(outDir, `pulled-img-${i + 1}${ext}`);
      await writeFile(path, buf);
      paths.push(path);
    } catch {
      /* skip */
    }
  }
  return {
    url,
    status: res.status,
    count: paths.length,
    paths,
    escalation,
    queue: "sync"
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function guessExt(url: string, contentType: string | null): string {
  const m = url.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i);
  if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg");
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  return ".jpg";
}
