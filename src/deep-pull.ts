/**
 * Deep site pull escalation for --allcopy / --allimg.
 * Order: fetch → wigolo crawl/fetch → playwright (a-eyes) → scrapy/scrapely (Python).
 * Polite: depth limits, path guesses (contact/about/services), no noisy admin paths.
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { writeJson } from "./io.js";
import { extractPageCopy, type PageCopy } from "./page-copy.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const LIGHT_PATHS = ["/about", "/about-us", "/contact", "/services", "/work", "/projects", "/team"];
const SKIP_RE = /(wp-admin|login|cart|checkout|cdn-cgi|api\/|\.pdf$|\.zip$)/i;
const A_EYES_PW = process.env.A_EYES_PLAYWRIGHT_PATH
  || "/Users/max/Documents/Code/a-eyes_mk2/a-eyes/node_modules/playwright";

export type DeepPullResult = {
  pages: Array<{ url: string; status: number; chars: number; path?: string }>;
  images: string[];
  escalation_used: string[];
  copy: PageCopy;
  notes: string[];
};

export async function deepPullSite(options: {
  url: string;
  outDir: string;
  wantCopy: boolean;
  wantImages: boolean;
  imgCount: number;
  maxPages?: number;
  maxDepth?: number;
}): Promise<DeepPullResult> {
  const outDir = options.outDir;
  await mkdir(outDir, { recursive: true });
  const notes: string[] = [];
  const escalation_used: string[] = [];
  const maxPages = Math.min(12, options.maxPages || 6);
  const maxDepth = Math.min(3, options.maxDepth || 2);
  let pages: DeepPullResult["pages"] = [];
  let images: string[] = [];
  let mergedText = "";

  // 1) Seed fetch
  escalation_used.push("fetch");
  const seed = await fetchPage(options.url);
  pages.push({ url: options.url, status: seed.status, chars: seed.text.length });
  mergedText += seed.text + "\n\n";
  if (options.wantImages) {
    images.push(...extractImageUrls(seed.html, options.url).slice(0, options.imgCount));
  }

  // 2) Light same-origin path probes (polite, small set)
  if (options.wantCopy || options.wantImages) {
    const origin = originOf(options.url);
    for (const path of LIGHT_PATHS) {
      if (pages.length >= maxPages) break;
      const probe = origin + path;
      try {
        const page = await fetchPage(probe);
        if (page.status >= 200 && page.status < 400 && page.text.length > 80) {
          pages.push({ url: probe, status: page.status, chars: page.text.length });
          mergedText += page.text + "\n\n";
          if (options.wantImages) {
            images.push(...extractImageUrls(page.html, probe));
          }
        }
        await sleep(350);
      } catch {
        /* skip dead paths */
      }
    }
    notes.push(`light-paths: probed ${LIGHT_PATHS.length}, kept ${pages.length - 1} extras`);
  }

  // 3) wigolo crawl when --all*
  if ((options.wantCopy || options.wantImages) && pages.length < maxPages) {
    const wigolo = await tryWigoloCrawl(options.url, maxDepth, maxPages);
    if (wigolo) {
      escalation_used.push("wigolo");
      notes.push(...wigolo.notes);
      for (const p of wigolo.pages) {
        if (pages.length >= maxPages) break;
        if (pages.some((x) => x.url === p.url)) continue;
        if (SKIP_RE.test(p.url)) continue;
        pages.push(p);
        mergedText += p.markdown + "\n\n";
      }
      images.push(...wigolo.images);
    }
  }

  // 4) Playwright (a-eyes node_modules) if still thin
  if (mergedText.length < 400 || (options.wantImages && images.length < options.imgCount)) {
    const pw = await tryPlaywrightCapture(options.url, outDir);
    if (pw) {
      escalation_used.push("playwright(a-eyes)");
      notes.push(pw.note);
      if (pw.text) mergedText += pw.text + "\n\n";
      if (pw.screenshotPath) notes.push(`screenshot: ${pw.screenshotPath}`);
      images.push(...pw.images);
    }
  }

  // 5) scrapely → scrapy (Python helpers; Gallery Parser uses scrapy)
  if (mergedText.length < 400) {
    const py = await tryPythonExtract(options.url, outDir);
    if (py) {
      escalation_used.push(py.tool);
      notes.push(py.note);
      mergedText += py.text + "\n\n";
    }
  }

  images = [...new Set(images)].filter((u) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u) || u.startsWith("http"));
  images = images.slice(0, Math.max(1, options.imgCount));

  const downloaded: string[] = [];
  if (options.wantImages) {
    for (let i = 0; i < images.length; i++) {
      try {
        const res = await fetch(images[i], {
          headers: { "user-agent": "RizzFizzPull/0.2 (+local; polite image GET)" },
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        const ext = guessExt(images[i], res.headers.get("content-type"));
        const path = join(outDir, `pulled-img-${i + 1}${ext}`);
        await writeFile(path, buf);
        downloaded.push(path);
      } catch {
        /* skip */
      }
    }
  }

  const copy = extractPageCopy(
    `<html><body>${mergedText.split("\n").map((l) => `<p>${escapeHtml(l.slice(0, 500))}</p>`).join("")}</body></html>`,
    options.url
  );
  // Prefer real seed HTML structure when available
  if (seed.html) {
    Object.assign(copy, extractPageCopy(seed.html, options.url));
    if (mergedText.length > (copy.body?.length || 0)) {
      copy.body = mergedText.slice(0, 12000).trim();
      copy.paragraphs = mergedText.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 40).slice(0, 20);
    }
  }

  await writeJson(join(outDir, "deep-pull.json"), {
    schema: "rizzfizz.deep-pull.v1",
    url: options.url,
    pages,
    escalation_used,
    image_urls: images,
    downloaded_images: downloaded,
    notes
  });
  await writeFile(join(outDir, "pulled-copy.txt"), mergedText.slice(0, 200_000), "utf8");
  await writeJson(join(outDir, "pulled-copy.json"), copy);

  return { pages, images: downloaded, escalation_used, copy, notes };
}

async function fetchPage(url: string): Promise<{ status: number; html: string; text: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "RizzFizzPull/0.2 (+local; polite GET; depth-limited)" },
    signal: AbortSignal.timeout(Number(process.env.RIZZFIZZ_PULL_TIMEOUT_MS || 8000))
  });
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { status: res.status, html, text };
}

async function tryWigoloCrawl(
  url: string,
  maxDepth: number,
  maxPages: number
): Promise<{ pages: Array<{ url: string; status: number; chars: number; markdown: string }>; images: string[]; notes: string[] } | null> {
  const wigolo = process.env.RIZZFIZZ_WIGOLO || "wigolo";
  try {
    const { stdout } = await execFileAsync(wigolo, [
      "crawl", url,
      "--max-depth", String(maxDepth),
      "--max-pages", String(maxPages),
      "--strategy", "bfs",
      "--include-patterns", String.raw`(about|contact|services|work|team|projects)`,
      "--exclude-patterns", String.raw`(wp-admin|login|cart|checkout)`,
      "--include-full-markdown",
      "--json"
    ], { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
    const data = JSON.parse(stdout);
    const results = data.pages || data.results || data.evidence || [];
    const pages: Array<{ url: string; status: number; chars: number; markdown: string }> = [];
    const images: string[] = [];
    for (const item of results) {
      const pageUrl = item.url || item.source_url || "";
      const md = item.markdown || item.content || item.excerpt || "";
      if (!pageUrl || !md) continue;
      pages.push({ url: pageUrl, status: 200, chars: md.length, markdown: md });
      const imgs = md.match(/https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif)/gi) || [];
      images.push(...imgs);
    }
    // Also try screenshot fetch of seed
    try {
      await execFileAsync(wigolo, ["fetch", url, "--screenshot", "--json"], { timeout: 45_000 });
    } catch {
      /* optional */
    }
    return { pages, images, notes: [`wigolo crawl: ${pages.length} pages`] };
  } catch (error) {
    return null;
  }
}

async function tryPlaywrightCapture(
  url: string,
  outDir: string
): Promise<{ text: string; images: string[]; screenshotPath?: string; note: string } | null> {
  try {
    const playwright = require(A_EYES_PW);
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(500);
      const text = await page.evaluate(() => document.body?.innerText || "");
      const images = await page.evaluate(() =>
        [...document.querySelectorAll("img[src]")].map((img) => (img as HTMLImageElement).src).slice(0, 12)
      );
      const screenshotPath = join(outDir, "a-eyes-seed.png");
      await page.screenshot({ path: screenshotPath, fullPage: false });
      return {
        text: String(text || "").slice(0, 80_000),
        images: images.filter(Boolean),
        screenshotPath,
        note: `playwright via ${A_EYES_PW}`
      };
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

async function tryPythonExtract(
  url: string,
  outDir: string
): Promise<{ tool: string; text: string; note: string } | null> {
  const script = join(fileDir(), "..", "scripts", "deep-extract.py");
  try {
    const { stdout } = await execFileAsync("python3", [script, url, "--out", outDir], {
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024
    });
    const data = JSON.parse(stdout);
    if (!data.ok) return null;
    return {
      tool: data.tool || "python-extract",
      text: data.text || "",
      note: data.note || "python extract"
    };
  } catch {
    return null;
  }
}

function fileDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function originOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

function extractImageUrls(html: string, base: string): string[] {
  return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => {
      try { return new URL(m[1], base).toString(); } catch { return m[1]; }
    });
}

function guessExt(url: string, contentType: string | null): string {
  const m = url.match(/\.(png|jpe?g|webp|gif|avif)(\?|$)/i);
  if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg");
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  return ".jpg";
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
