/**
 * Font optical-balance via a-eyes playwright screenshots.
 * Renders site-name samples, measures ink bbox padding, grows a local corpus.
 */

import { access, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readJson, writeJson } from "./io.js";

const require = createRequire(import.meta.url);
const A_EYES_PW = process.env.A_EYES_PLAYWRIGHT_PATH
  || "/Users/max/Documents/Code/a-eyes_mk2/a-eyes/node_modules/playwright";

export type FontBalanceEntry = {
  font: string;
  sample: string;
  pad_top: number;
  pad_bottom: number;
  pad_left: number;
  pad_right: number;
  balanced: boolean;
  screenshot?: string;
  measured_at: string;
};

export type FontBalanceCorpus = {
  schema: "rizzfizz.font-balance.v1";
  updated_at: string;
  entries: FontBalanceEntry[];
};

const CORPUS_PATH = join(homedir(), ".config", "rizzfizz", "font-balance-corpus.json");

export async function loadFontBalanceCorpus(): Promise<FontBalanceCorpus> {
  if (!(await exists(CORPUS_PATH))) {
    return { schema: "rizzfizz.font-balance.v1", updated_at: new Date().toISOString(), entries: [] };
  }
  try {
    return await readJson<FontBalanceCorpus>(CORPUS_PATH);
  } catch {
    return { schema: "rizzfizz.font-balance.v1", updated_at: new Date().toISOString(), entries: [] };
  }
}

export function lookupFontBalance(corpus: FontBalanceCorpus, font: string, sample: string): FontBalanceEntry | undefined {
  return corpus.entries.find((e) => e.font === font && e.sample === sample);
}

/**
 * Screenshot a site-name sample in `font` and measure padding asymmetry.
 * Uses a-eyes' playwright install. Writes PNG under outDir when provided.
 */
export async function measureFontBalance(options: {
  font: string;
  sample: string;
  outDir?: string;
}): Promise<FontBalanceEntry> {
  const font = options.font || "INSP-VALUE";
  const sample = options.sample || "INSP-VALUE";
  if (font === "INSP-VALUE" || sample === "INSP-VALUE") {
    return {
      font,
      sample,
      pad_top: 0,
      pad_bottom: 0,
      pad_left: 0,
      pad_right: 0,
      balanced: false,
      measured_at: new Date().toISOString()
    };
  }

  const playwright = require(A_EYES_PW);
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 200 } });
    const html = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}&display=swap">
<style>
  html,body{margin:0;background:#111;color:#f5f5f5}
  .box{display:flex;align-items:center;justify-content:center;height:200px;width:640px}
  h1{margin:0;font:650 48px/1.1 "${font}", system-ui, sans-serif;white-space:nowrap}
</style></head><body><div class="box"><h1 id="s">${escapeHtml(sample)}</h1></div></body></html>`;
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const el = document.getElementById("s");
      const box = document.querySelector(".box");
      if (!el || !box) return null;
      const er = el.getBoundingClientRect();
      const br = box.getBoundingClientRect();
      return {
        pad_top: er.top - br.top,
        pad_bottom: br.bottom - er.bottom,
        pad_left: er.left - br.left,
        pad_right: br.right - er.right
      };
    });
    let screenshot: string | undefined;
    if (options.outDir) {
      await mkdir(options.outDir, { recursive: true });
      screenshot = join(options.outDir, `font-balance-${slug(font)}.png`);
      await page.screenshot({ path: screenshot });
    }
    const pad = metrics || { pad_top: 0, pad_bottom: 0, pad_left: 0, pad_right: 0 };
    const vDiff = Math.abs(pad.pad_top - pad.pad_bottom);
    const hDiff = Math.abs(pad.pad_left - pad.pad_right);
    const entry: FontBalanceEntry = {
      font,
      sample,
      ...pad,
      balanced: vDiff <= 6 && hDiff <= 24,
      screenshot,
      measured_at: new Date().toISOString()
    };
    await appendCorpus(entry);
    return entry;
  } finally {
    await browser.close();
  }
}

async function appendCorpus(entry: FontBalanceEntry): Promise<void> {
  const corpus = await loadFontBalanceCorpus();
  const idx = corpus.entries.findIndex((e) => e.font === entry.font && e.sample === entry.sample);
  if (idx >= 0) corpus.entries[idx] = entry;
  else corpus.entries.push(entry);
  corpus.updated_at = new Date().toISOString();
  await mkdir(dirname(CORPUS_PATH), { recursive: true });
  await writeJson(CORPUS_PATH, corpus);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "font";
}

function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
