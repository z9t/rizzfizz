#!/usr/bin/env node
/* Rebuild data/color-names.json from open sources.
   Purpose: refresh the riff dictionary without Pantone.
   Inputs (optional local caches): /tmp/xkcd-colors.json, /tmp/meodai.csv
   Output: data/color-names.json
*/
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "data", "color-names.json");

if (!existsSync("/tmp/xkcd-colors.json") || !existsSync("/tmp/meodai.csv")) {
  console.error("Missing caches. Fetch first:");
  console.error("  curl -fsSL https://raw.githubusercontent.com/dariusk/corpora/master/data/colors/xkcd.json -o /tmp/xkcd-colors.json");
  console.error("  curl -fsSL https://raw.githubusercontent.com/meodai/color-names/master/src/colornames.csv -o /tmp/meodai.csv");
  process.exit(2);
}

console.error("Re-run the merge via the session builder, or keep existing", outPath);
console.error("Current file bytes:", existsSync(outPath) ? readFileSync(outPath).length : 0);
