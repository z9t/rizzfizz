import { access, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { nearestNamedColors } from "./color-names.js";
import { readJson, readText } from "./io.js";
import { inspectRun } from "./manifest.js";
import type { PaletteRun } from "./types.js";

type ReadColor = { hex: string; name?: string; role?: string };

type ReadResult = {
  mode: "run" | "palette-run" | "riff-run" | "css" | "html" | "text";
  path: string;
  summary: string;
  colors: ReadColor[];
};

type LooseRiffRun = {
  schema?: string;
  seed?: string;
  palettes?: Array<{ id?: string; swatches?: Array<{ hex?: string; name?: string }> }>;
  spec?: { locked?: Array<{ name?: string }> };
};

/** Read-only inspection — never generates new palette variants. */
export async function readInput(inputPath: string): Promise<ReadResult> {
  const path = resolve(inputPath);
  const st = await stat(path);

  if (st.isDirectory()) {
    const summary = await inspectRun(path);
    const palettePath = join(path, "palette-run.json");
    const colors = (await exists(palettePath))
      ? extractFromPaletteRun(await readJson<PaletteRun>(palettePath))
      : [];
    return {
      mode: "run",
      path,
      summary: `${summary}\nMode: read-only (no generation)`,
      colors
    };
  }

  const text = await readText(path);
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    if (json.schema === "rizzfizz.riff-run.v1") {
      return readRiffRun(path, json as LooseRiffRun);
    }
    if (json.schema === "rizzfizz.palette-run.v1" || Array.isArray(json.variants)) {
      const run = json as unknown as PaletteRun;
      const colors = extractFromPaletteRun(run);
      return {
        mode: "palette-run",
        path,
        summary: [
          `Palette run: ${path}`,
          `Schema: ${run.schema || "unknown"}`,
          `Relationship: ${run.relationship || "n/a"}`,
          `Hue family: ${run.hue_family || "n/a"}`,
          `Variants: ${(run.variants || []).length}`,
          "Mode: read-only (no generation)"
        ].join("\n"),
        colors
      };
    }
  }

  const lower = path.toLowerCase();
  const colors = extractHexes(text);
  const mode = lower.endsWith(".css")
    ? "css"
    : lower.endsWith(".html") || lower.endsWith(".htm")
      ? "html"
      : "text";
  return {
    mode,
    path,
    summary: [
      `Read colours from: ${path}`,
      `Distinct hexes: ${colors.length}`,
      "Mode: read-only (no generation)"
    ].join("\n"),
    colors
  };
}

function readRiffRun(path: string, run: LooseRiffRun): ReadResult {
  const colors: ReadColor[] = [];
  for (const palette of run.palettes || []) {
    for (const swatch of palette.swatches || []) {
      if (!swatch.hex) continue;
      colors.push({
        hex: swatch.hex,
        name: swatch.name,
        role: palette.id
      });
    }
  }
  return {
    mode: "riff-run",
    path,
    summary: [
      `Riff run: ${path}`,
      `Seed: ${run.seed || "n/a"}`,
      `Versions: ${(run.palettes || []).length}`,
      `Locked: ${(run.spec?.locked || []).map((l) => l.name).filter(Boolean).join(", ") || "(none)"}`,
      "Mode: read-only (no generation)"
    ].join("\n"),
    colors
  };
}

function extractFromPaletteRun(run: PaletteRun): ReadColor[] {
  const out: ReadColor[] = [];
  for (const variant of run.variants || []) {
    for (const [role, hex] of Object.entries(variant.tokens || {})) {
      if (typeof hex !== "string") continue;
      out.push({
        hex: hex.toUpperCase(),
        role: `${variant.id}.${role}`,
        name: nearestNamedColors(hex, 1)[0]?.name
      });
    }
  }
  return out;
}

function extractHexes(text: string): ReadColor[] {
  const found = [...text.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => `#${m[1].toUpperCase()}`);
  return [...new Set(found)].map((hex) => ({ hex, name: nearestNamedColors(hex, 1)[0]?.name }));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
