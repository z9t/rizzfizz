import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = join(process.cwd(), "bin/cli.js");

describe("riff DSL", () => {
  test("parses locked multi-word colours + gen + versions", async () => {
    const { runRiff } = await import("../dist/riff.js");
    const run = runRiff({
      spec: "orange, dark blue grey, 3, +3",
      seed: "test-seed-1"
    });
    assert.equal(run.schema, "rizzfizz.riff-run.v1");
    assert.equal(run.spec.locked.length, 2);
    assert.equal(run.spec.generated_count, 3);
    assert.equal(run.palettes.length, 3);
    assert.equal(run.palettes[0].swatches.length, 5);
    assert.ok(run.palettes[0].swatches.filter((s) => s.locked).length === 2);
    assert.equal(run.seed, "test-seed-1");
    assert.ok(run.flags.reriff_hint.includes("reriff"));
  });

  test("blue green, 3, +5 locks one multi-word colour", async () => {
    const { runRiff } = await import("../dist/riff.js");
    const run = runRiff({ spec: "blue green, 3, +5", seed: "bg" });
    assert.equal(run.spec.locked.length, 1);
    assert.equal(run.spec.locked[0].name, "blue green");
    assert.equal(run.spec.generated_count, 3);
    assert.equal(run.palettes.length, 5);
    assert.equal(run.palettes[0].swatches.length, 4);
  });

  test("~blue(+10) warns past large ranges and stays deterministic", async () => {
    const { runRiff } = await import("../dist/riff.js");
    const a = runRiff({ spec: "~blue(+10), 2, +2", seed: "same" });
    const b = runRiff({ spec: "~blue(+10), 2, +2", seed: "same" });
    assert.deepEqual(a.palettes[0].swatches.map((s) => s.hex), b.palettes[0].swatches.map((s) => s.hex));
    const big = runRiff({ spec: "~blue(+80), 1, +1", seed: "warn" });
    assert.ok(big.warnings.some((w) => w.code === "range-past-midpoint" || w.code === "neighbour-overshoot"));
  });

  test("~ALL(-35,-20,-10) emits per-version rolls", async () => {
    const { runRiff } = await import("../dist/riff.js");
    const run = runRiff({ spec: "~ALL(-35,-20,-10), orange, 2, +3", seed: "all" });
    assert.equal(run.palettes.length, 3);
    assert.ok(run.flags.rolls.length >= 1);
    for (const roll of run.flags.rolls) {
      assert.ok(typeof roll.percent === "number");
      assert.ok(roll.hex.startsWith("#"));
    }
  });

  test("CLI riff + reriff lock round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rizzfizz-riff-"));
    const out = join(dir, "riff.json");
    await execFileAsync(process.execPath, [cli, "riff", "blue, 2, +2", "--seed", "cli-seed", "--out", out], {
      cwd: process.cwd()
    });
    const run = JSON.parse(await readFile(out, "utf8"));
    assert.equal(run.schema, "rizzfizz.riff-run.v1");
    const lockHex = run.spec.locked[0].hex;
    const out2 = join(dir, "reriff.json");
    await execFileAsync(process.execPath, [
      cli, "reriff",
      "--input", out,
      "--lock", lockHex,
      "--spec", "1, +2",
      "--seed", "reriff-seed",
      "--out", out2
    ], { cwd: process.cwd() });
    const again = JSON.parse(await readFile(out2, "utf8"));
    assert.equal(again.schema, "rizzfizz.riff-run.v1");
    assert.ok(again.spec.locked.some((l) => l.hex === lockHex));
  });

  test("read mode does not require generation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rizzfizz-read-"));
    const palette = {
      schema: "rizzfizz.palette-run.v1",
      created_at: new Date().toISOString(),
      relationship: "dark-sparse-accent",
      hue_family: "blue",
      source: "test",
      variants: [{
        id: "variant-1",
        name: "Test",
        strategy: "dark-sparse-accent",
        hue_family: "blue",
        hue: 252,
        tokens: {
          paper: "#111111", panel: "#222222", ink: "#F5F5F5", muted: "#AAAAAA",
          accent: "#3B82F6", accent_strong: "#1D4ED8", line: "#333333"
        },
        palette_relationship: {
          tone: "dark", accent_usage: "sparse", chroma: "x", contrast: "x", relationship: "x"
        },
        palette_usage: "x",
        checks: { contrast: [], warnings: [], failures: [] }
      }]
    };
    const path = join(dir, "palette-run.json");
    await writeFile(path, JSON.stringify(palette));
    const { stdout } = await execFileAsync(process.execPath, [cli, "read", "--input", path], { cwd: process.cwd() });
    assert.match(stdout, /read-only/i);
    assert.match(stdout, /#111111/i);
  });

  test("colors search finds dictionary entries", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cli, "colors", "--search", "ocean blue", "--limit", "5"], {
      cwd: process.cwd()
    });
    assert.match(stdout, /ocean blue/i);
  });
});
