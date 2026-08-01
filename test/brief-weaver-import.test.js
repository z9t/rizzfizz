import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { importBriefWeaverRun } from "../dist/brief-weaver.js";

const leakyFixture = new URL("./fixtures/brief-weaver-leaky/", import.meta.url).pathname;
const LEAK = "LEAKY_BW_BRAND_7c2e";

test("import-brief-weaver re-scrubs leaky brand tokens from builder-facing outputs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-bw-leaky-"));
  try {
    const out = join(dir, "run");
    await importBriefWeaverRun({ input: leakyFixture, out, preview: false });
    const files = [
      "DESIGN-neutral.md",
      "DESIGN-variant-1.md",
      "build-contract.json",
      "scrubbed-design-dna.json"
    ];
    for (const rel of files) {
      const text = await readFile(join(out, rel), "utf8");
      assert.equal(text.includes(LEAK), false, `leak remains in ${rel}`);
    }
    const briefs = await readdir(join(out, "builder-briefs"));
    for (const brief of briefs) {
      const text = await readFile(join(out, "builder-briefs", brief), "utf8");
      assert.equal(text.includes(LEAK), false, `leak remains in builder-briefs/${brief}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
