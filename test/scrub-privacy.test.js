import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { buildRawReference, scrubSourceText } from "../dist/scrub.js";

const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;
const privacyDir = new URL("./fixtures/privacy/", import.meta.url).pathname;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/;
const HANDLE_RE = /(?<![\w-])@[A-Za-z][A-Za-z0-9_]{2,}\b/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

async function scrubFixture(name) {
  const fixturePath = join(privacyDir, name);
  const raw = await readFile(fixturePath, "utf8");
  const ref = buildRawReference(fixturePath, raw);
  const scrubbed = scrubSourceText(raw, ref.extracted.possible_identity_terms);
  return { raw, ref, scrubbed, fixturePath };
}

test("phones-and-handles: URLs emails phones handles redacted", async () => {
  const { scrubbed } = await scrubFixture("phones-and-handles.md");
  assert.equal(scrubbed.includes("https://"), false);
  assert.equal(EMAIL_RE.test(scrubbed), false);
  assert.equal(PHONE_RE.test(scrubbed), false);
  assert.equal(HANDLE_RE.test(scrubbed), false);
  assert.match(scrubbed, /spacious/i);
  assert.match(scrubbed, /gallery/i);
});

test("multi-url: https and mailto redacted", async () => {
  const { scrubbed } = await scrubFixture("multi-url.md");
  assert.equal(scrubbed.includes("https://"), false);
  assert.equal(scrubbed.includes("mailto:"), false);
  assert.equal(EMAIL_RE.test(scrubbed), false);
  assert.match(scrubbed, /spacious/i);
});

test("gap: unlabeled brand in prose still may survive (no Brand: label)", async (t) => {
  t.skip("characterization: unlabeled ZephyrOptics without Brand: label remains a known NLP-level gap");
});

test("slogan fixture: distinctive phrase absent from builder-facing scrub outputs", async () => {
  const slogan = "ZEPHYR_CALM_CINEMATIC_SLOGAN_9f3a";
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-slogan-"));
  try {
    const out = join(dir, "run");
    await execFileAsync("node", [
      cli,
      "scrub-md",
      "--input",
      join(privacyDir, "slogan-and-clone.md"),
      "--variants",
      "1",
      "--out",
      out
    ]);
    for (const rel of [
      "scrubbed-design-dna.json",
      "DESIGN-neutral.md",
      "DESIGN-variant-1.md",
      "build-contract.json",
      "builder-briefs/variant-1.md"
    ]) {
      const text = await readFile(join(out, rel), "utf8");
      assert.equal(text.includes(slogan), false, `slogan leaked in ${rel}`);
      assert.equal(text.includes("## Source-Safe Notes"), false, `full notes section in ${rel}`);
    }
    const contract = JSON.parse(await readFile(join(out, "build-contract.json"), "utf8"));
    const evidence = contract.design_system_classification.source_safe_evidence;
    assert.ok(Array.isArray(evidence));
    assert.equal(evidence.join(" ").includes(slogan), false);
    assert.ok(evidence.every((item) => /^(term|quality):/.test(item)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("font-only brand token is scrubbed from text and builder outputs", async () => {
  const { scrubbed, ref } = await scrubFixture("font-only-brand.md");
  assert.ok(ref.extracted.possible_fonts.some((font) => /Nightingale/i.test(font)));
  assert.ok(ref.extracted.possible_identity_terms.some((term) => /Nightingale/i.test(term)));
  assert.equal(scrubbed.includes("Nightingale"), false);
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-font-"));
  try {
    const out = join(dir, "run");
    await execFileAsync("node", [
      cli, "scrub-md", "--input", join(privacyDir, "font-only-brand.md"), "--variants", "1", "--out", out
    ]);
    const dna = await readFile(join(out, "scrubbed-design-dna.json"), "utf8");
    const contract = await readFile(join(out, "build-contract.json"), "utf8");
    assert.equal(dna.includes("Nightingale"), false);
    assert.equal(contract.includes("Nightingale"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("absolute paths and file:// URIs are redacted", async () => {
  const { scrubbed } = await scrubFixture("absolute-fs-locs.md");
  assert.equal(scrubbed.includes("/Users/somebody"), false);
  assert.equal(scrubbed.includes("file:///tmp/ref-nightingale-path.md"), false);
  assert.match(scrubbed, /\[source path removed\]/);
  assert.match(scrubbed, /spacious/i);
});

test("brand label below line 25 becomes identity and is scrubbed", async () => {
  const { scrubbed, ref } = await scrubFixture("brand-below-line-25.md");
  assert.ok(ref.extracted.possible_identity_terms.includes("NightingaleLabs"));
  assert.equal(scrubbed.includes("NightingaleLabs"), false);
  assert.match(scrubbed, /spacious/i);
});

test("scrub-md CLI: phones-and-handles builder bundle has no phone/handle/email/url", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-privacy-"));
  try {
    const out = join(dir, "run");
    await execFileAsync("node", [
      cli,
      "scrub-md",
      "--input",
      join(privacyDir, "phones-and-handles.md"),
      "--variants",
      "1",
      "--out",
      out
    ]);
    const contract = await readFile(join(out, "build-contract.json"), "utf8");
    const dna = await readFile(join(out, "scrubbed-design-dna.json"), "utf8");
    const brief = await readFile(join(out, "builder-briefs", "variant-1.md"), "utf8");
    const bundle = `${contract}\n${dna}\n${brief}`;
    assert.equal(bundle.includes("https://"), false);
    assert.equal(bundle.includes("hello@example-privacy.test"), false);
    assert.equal(bundle.includes("@zephyr_ops_handle"), false);
    assert.equal(bundle.includes("+61 412 345 678"), false);
    assert.equal(bundle.includes("(415) 555-0199"), false);
    assert.equal(HANDLE_RE.test(bundle), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
