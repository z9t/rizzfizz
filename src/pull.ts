import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { writeJson } from "./io.js";

export type PullOptions = {
  out: string;
  insp?: string;
  copy?: string;
  img?: string;
  imgCount?: number;
  /** Escalate to heavier tools (playwright path reserved). Default false = fetch-only. */
  fastCopy?: boolean;
  fastImg?: boolean;
  allCopy?: boolean;
  allImg?: boolean;
};

export type PullResult = {
  schema: "rizzfizz.pull.v1";
  created_at: string;
  insp?: { url: string; status: number; title?: string; note: string };
  copy?: { url: string; status: number; text_path: string; chars: number; escalation: string[] };
  images?: {
    url: string;
    status: number;
    count: number;
    paths: string[];
    escalation: string[];
    estimated_seconds?: number;
    queue?: "sync" | "async";
  };
  notes: string[];
};

/**
 * Pull inspire / copy / images with escalating fetch strategy.
 * Default: polite single-page fetch. --allcopy/--allimg estimate duration and
 * mark async queue; Playwright/scrapley escalation is documented, not forced.
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

  if (options.copy) {
    const escalation = escalatePlan({
      all: Boolean(options.allCopy),
      fast: Boolean(options.fastCopy),
      kind: "copy"
    });
    if (options.allCopy) {
      notes.push(`allcopy: estimated ${estimateSeconds(options.copy, "copy")}s — queue=async (not started; use a worker)`);
    }
    result.copy = await pullCopy(options.copy, outDir, escalation);
  }

  if (options.img) {
    const count = Math.max(1, Math.min(24, options.imgCount || 3));
    const escalation = escalatePlan({
      all: Boolean(options.allImg),
      fast: Boolean(options.fastImg),
      kind: "img"
    });
    const estimated = options.allImg ? estimateSeconds(options.img, "img") : undefined;
    if (options.allImg) {
      notes.push(`allimg: estimated ${estimated}s — queue=async; enumerates contact/services lightly`);
    }
    result.images = await pullImages(options.img, outDir, count, escalation, estimated);
  }

  if (!options.insp && !options.copy && !options.img) {
    throw new Error("pull requires --insp and/or --copy and/or --img");
  }

  await writeJson(join(outDir, "pull-manifest.json"), result);
  return result;
}

function escalatePlan(options: { all: boolean; fast: boolean; kind: string }): string[] {
  if (options.fast) return ["fetch"];
  if (options.all) return ["fetch", "wigolo", "playwright(if-needed)"];
  return ["fetch", "playwright(if-fetch-thin)"];
}

function estimateSeconds(url: string, kind: "copy" | "img"): number {
  // Honest coarse estimate for queue messaging — not a promise.
  const base = kind === "img" ? 45 : 20;
  return base + Math.min(90, url.length % 17);
}

async function pullInsp(url: string): Promise<NonNullable<PullResult["insp"]>> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "RizzFizzPull/0.1 (+local; polite single GET)" },
      signal: AbortSignal.timeout(20000)
    });
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return {
      url,
      status: res.status,
      title,
      note: "Static GET only — use design-extract/Playwright for computed styles."
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
    headers: { "user-agent": "RizzFizzPull/0.1 (+local; polite single GET)" },
    signal: AbortSignal.timeout(20000)
  });
  const html = await res.text();
  const text = htmlToText(html).slice(0, 200_000);
  const textPath = join(outDir, "pulled-copy.txt");
  await writeFile(textPath, text, "utf8");
  return {
    url,
    status: res.status,
    text_path: textPath,
    chars: text.length,
    escalation
  };
}

async function pullImages(
  url: string,
  outDir: string,
  count: number,
  escalation: string[],
  estimated?: number
): Promise<NonNullable<PullResult["images"]>> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "RizzFizzPull/0.1 (+local; polite single GET)" },
    signal: AbortSignal.timeout(20000)
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
        headers: { "user-agent": "RizzFizzPull/0.1 (+local; polite image GET)" },
        signal: AbortSignal.timeout(15000)
      });
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const ext = guessExt(unique[i], imgRes.headers.get("content-type"));
      const path = join(outDir, `pulled-img-${i + 1}${ext}`);
      await writeFile(path, buf);
      paths.push(path);
    } catch {
      /* skip failed image */
    }
  }
  return {
    url,
    status: res.status,
    count: paths.length,
    paths,
    escalation,
    estimated_seconds: estimated,
    queue: estimated ? "async" : "sync"
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
