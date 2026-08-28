/**
 * Persistable CLI defaults — features are independently on/off.
 * `rizzfizz set-default --studio --tokens` writes this; scrub-md merges unless overridden.
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { access } from "node:fs/promises";
import { readJson, writeJson } from "./io.js";

export type ScrubDefaults = {
  studio?: boolean;
  tokens?: boolean;
  preview?: boolean;
  handoff?: boolean;
  to?: string;
  from?: string;
  bar?: "top" | "bottom" | "both";
  /** When true and --insp is a URL without --copy, also pull copy. */
  copy_from_insp?: boolean;
};

export type RizzfizzDefaults = {
  schema: "rizzfizz.defaults.v1";
  updated_at: string;
  scrub_md: ScrubDefaults;
};

const LOCAL_NAME = ".rizzfizz-defaults.json";
const GLOBAL_PATH = join(homedir(), ".config", "rizzfizz", "defaults.json");

function workingDir(cwd?: string): string {
  return resolve(cwd || process.env.PWD || ".");
}

export function defaultsPaths(cwd?: string): { local: string; global: string } {
  return { local: join(workingDir(cwd), LOCAL_NAME), global: GLOBAL_PATH };
}

export async function loadDefaults(cwd?: string): Promise<RizzfizzDefaults> {
  const { local, global } = defaultsPaths(cwd);
  for (const path of [local, global]) {
    if (!(await exists(path))) continue;
    try {
      const raw = await readJson<RizzfizzDefaults>(path);
      if (raw?.schema === "rizzfizz.defaults.v1") return raw;
    } catch {
      /* ignore corrupt */
    }
  }
  return emptyDefaults();
}

export async function saveDefaults(
  patch: ScrubDefaults,
  options: { global?: boolean; cwd?: string } = {}
): Promise<{ path: string; defaults: RizzfizzDefaults }> {
  const cwd = workingDir(options.cwd);
  const { local, global } = defaultsPaths(cwd);
  const path = options.global ? global : local;
  const current = await loadDefaults(cwd);
  const next: RizzfizzDefaults = {
    schema: "rizzfizz.defaults.v1",
    updated_at: new Date().toISOString(),
    scrub_md: { ...current.scrub_md, ...patch }
  };
  await writeJson(path, next);
  return { path, defaults: next };
}

export async function clearDefaults(options: { global?: boolean; cwd?: string } = {}): Promise<string> {
  const empty = emptyDefaults();
  const cwd = workingDir(options.cwd);
  const path = options.global ? defaultsPaths(cwd).global : defaultsPaths(cwd).local;
  await writeJson(path, empty);
  return path;
}

export function emptyDefaults(): RizzfizzDefaults {
  return {
    schema: "rizzfizz.defaults.v1",
    updated_at: new Date().toISOString(),
    scrub_md: {
      studio: false,
      tokens: false,
      preview: false,
      handoff: false,
      copy_from_insp: true,
      bar: "both"
    }
  };
}

/** True if argv contains exactly this flag (not a value). */
export function argvHasFlag(flag: string, argv = process.argv): boolean {
  return argv.includes(flag);
}

/**
 * Resolve a boolean feature: explicit --flag / --no-flag wins; else defaults.
 */
export function resolveBoolFeature(
  argv: string[],
  onFlag: string,
  offFlag: string,
  defaultValue: boolean | undefined
): boolean {
  if (argvHasFlag(onFlag, argv)) return true;
  if (argvHasFlag(offFlag, argv)) return false;
  return Boolean(defaultValue);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
