import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cli = new URL("../bin/cli.js", import.meta.url).pathname;
const fixture = new URL("./fixtures/DESIGN-source.md", import.meta.url).pathname;
const aEyesSampleRunner = new URL("../scripts/run-aeyes-intake-sample.mjs", import.meta.url).pathname;
const waffleFixture = new URL("./fixtures/waffle-scan.json", import.meta.url).pathname;
const weakWhifflerFixture = new URL("./fixtures/whiffler-weak-scan.json", import.meta.url).pathname;

test("palette command writes palette-run JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const out = join(dir, "palette-run.json");
    await execFileAsync("node", [cli, "palette", "--relationship", "dark-sparse-accent", "--hue", "blue", "--variants", "3", "--out", out]);
    const run = JSON.parse(await readFile(out, "utf8"));
    assert.equal(run.schema, "rizzfizz.palette-run.v1");
    assert.equal(run.variants.length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scrub-md writes private and builder-facing artifacts without source identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", dir]);
    const raw = JSON.parse(await readFile(join(dir, "raw-reference.json"), "utf8"));
    const dna = await readFile(join(dir, "scrubbed-design-dna.json"), "utf8");
    const contract = JSON.parse(await readFile(join(dir, "build-contract.json"), "utf8"));
    const designScore = JSON.parse(await readFile(join(dir, "design-score.json"), "utf8"));
    const visualTokens = JSON.parse(await readFile(join(dir, "visual-tokens.json"), "utf8"));
    const manifest = JSON.parse(await readFile(join(dir, "run-manifest.json"), "utf8"));
    const contractText = JSON.stringify(contract);
    const brief = await readFile(join(dir, "builder-briefs", "variant-1.md"), "utf8");
    const variants = JSON.parse(await readFile(join(dir, "variants-palette.json"), "utf8"));
    const intakeVariants = JSON.parse(await readFile(join(dir, "variants.json"), "utf8"));

    assert.equal(raw.raw_text.includes("https://acme.example.com/aurora"), true);
    assert.equal(dna.includes("https://acme.example.com/aurora"), false);
    assert.equal(contract.schema, "rizzfizz.build-contract.v1");
    assert.equal(contract.source_safe, true);
    assert.equal(contractText.includes("https://acme.example.com/aurora"), false);
    assert.equal(contractText.includes("Acme"), false);
    assert.equal(contractText.includes("recreate"), false);
    assert.equal(contract.design_system_classification.schema, "rizzfizz.design-system-classification.v1");
    assert.equal(contract.design_system_classification.primary.id, "neo-minimalism");
    assert.equal(designScore.schema, "rizzfizz.design-score-report.v1");
    assert.equal(designScore.source_safe, true);
    assert.ok(designScore.exportable_guidance.json.palette_constraints.length > 0);
    assert.ok(designScore.exportable_guidance.json.archetype_constraints.locked.length > 0);
    assert.match(manifest.optional_artifacts.design_score, /design-score\.json$/);
    assert.equal(JSON.stringify(designScore).includes("https://acme.example.com/aurora"), false);
    assert.equal(JSON.parse(dna).design_style.classification.primary.id, "neo-minimalism");
    assert.ok(contract.intent.primary_job);
    assert.ok(contract.layout.regions.length >= 3);
    assert.ok(contract.motion.patterns.length >= 3);
    assert.ok(contract.visual_qa.fail_if.length >= 3);
    assert.equal(visualTokens.schema, "rizzfizz.visual-tokens.v1");
    assert.equal(visualTokens.variants.length, 2);
    assert.ok(visualTokens.variants[0].actions.focus_ring);
    assert.ok(visualTokens.variants[0].data_viz.categorical.length >= 6);
    assert.equal(manifest.schema, "rizzfizz.run-manifest.v1");
    assert.match(manifest.recommended_start, /build-contract\.json$/);
    assert.match(manifest.source_safe_entrypoints.variants_json, /variants\.json$/);
    assert.match(brief, /Implementation Contract/);
    assert.match(brief, /Design System Quality Direction/);
    assert.match(brief, /Neo-Minimalism/);
    assert.match(brief, /Motion Contract/);
    assert.match(brief, /Visual QA/);
    assert.equal(brief.includes("Acme"), false);
    assert.equal(brief.includes("recreate"), false);
    assert.equal(variants.variants.length, 2);
    assert.ok(variants.variants[0].palette_tokens.paper);
    assert.ok(intakeVariants.master_brief.title);
    assert.equal(intakeVariants.shared_constraints.a_eyes_required, true);
    assert.deepEqual(intakeVariants.shared_constraints.viewport_targets, ["desktop", "mobile"]);
    assert.equal(intakeVariants.variants.length, 2);
    assert.equal(intakeVariants.variants[0].id, "variant-1");
    assert.ok(intakeVariants.variants[0].design_direction);
    assert.ok(intakeVariants.variants[0].layout_strategy);
    assert.ok(intakeVariants.variants[0].palette_tokens.paper);
    assert.ok(intakeVariants.variants[0].technology_direction.stack);
    assert.ok(intakeVariants.variants[0].technology_direction.animation.library);
    assert.ok(intakeVariants.variants[0].motion_direction);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspect command prints a compact run summary", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", dir]);
    const { stdout } = await execFileAsync("node", [cli, "inspect", "--input", dir]);
    assert.match(stdout, /RizzFizz run:/);
    assert.match(stdout, /Recommended start:/);
    assert.match(stdout, /Site type:/);
    assert.match(stdout, /Visual token variants: 2/);
    assert.match(stdout, /Motion level:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preview command writes a static source-safe variant selection page", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", join(dir, "run")]);
    const out = join(dir, "preview.html");
    const { stdout } = await execFileAsync("node", [cli, "preview", "--input", join(dir, "run"), "--out", out]);
    const html = await readFile(out, "utf8");

    assert.match(stdout, /Wrote preview:/);
    assert.match(html, /RizzFizz static run preview/);
    assert.match(html, /Typography Direction/);
    assert.match(html, /Layout Intent/);
    assert.match(html, /Motion Notes/);
    assert.match(html, /Design system quality classification/);
    assert.match(html, /Neo-Minimalism/);
    assert.match(html, /Key Contract Details/);
    assert.match(html, /variant-1/);
    assert.match(html, /variant-2/);
    assert.match(html, /palette_tokens/);
    assert.match(html, /variants-palette\.json/);
    assert.equal(html.includes("Acme"), false);
    assert.equal(html.includes("https://acme.example.com/aurora"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("import-brief-weaver maps an existing source-safe run into a RizzFizz run surface", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const briefWeaverRun = join(dir, "brief-weaver-runs", "sample-bridge");
    const out = join(dir, "rizzfizz-run");
    await writeBriefWeaverFixture(briefWeaverRun);

    const { stdout } = await execFileAsync("node", [
      cli,
      "import-brief-weaver",
      "--input",
      briefWeaverRun,
      "--out",
      out
    ]);

    const manifest = JSON.parse(await readFile(join(out, "run-manifest.json"), "utf8"));
    const paletteRun = JSON.parse(await readFile(join(out, "palette-run.json"), "utf8"));
    const variantsPalette = JSON.parse(await readFile(join(out, "variants-palette.json"), "utf8"));
    const intakeVariants = JSON.parse(await readFile(join(out, "variants.json"), "utf8"));
    const rawReference = JSON.parse(await readFile(join(out, "raw-reference.json"), "utf8"));
    const preview = await readFile(join(out, "preview.html"), "utf8");
    const builderBrief = await readFile(join(out, "builder-briefs", "variant-1.md"), "utf8");
    const sourceSafeBundle = [
      JSON.stringify(manifest),
      JSON.stringify(paletteRun),
      JSON.stringify(variantsPalette),
      JSON.stringify(intakeVariants),
      preview,
      builderBrief,
      await readFile(join(out, "DESIGN-variant-1.md"), "utf8")
    ].join("\n");

    assert.match(stdout, /Imported Brief Weaver run:/);
    assert.match(stdout, /Preview:/);
    assert.equal(manifest.schema, "rizzfizz.run-manifest.v1");
    assert.match(manifest.source_safe_entrypoints.preview_html, /preview\.html$/);
    assert.equal(paletteRun.schema, "rizzfizz.palette-run.v1");
    assert.equal(paletteRun.source, "brief-weaver:sample-bridge");
    assert.equal(paletteRun.variants.length, 2);
    assert.equal(paletteRun.variants[0].tokens.paper, "#071114");
    assert.equal(variantsPalette.schema, "rizzfizz.a-eyes-variant-tokens.v1");
    assert.equal(variantsPalette.variants[0].technology_direction.stack, "static-html-css-js");
    assert.equal(intakeVariants.variants.length, 2);
    assert.equal(intakeVariants.variants[0].technology_direction.stack, "static-html-css-js");
    assert.match(preview, /RizzFizz static run preview/);
    assert.match(preview, /variant-1/);
    assert.equal(rawReference.raw_text, "");
    assert.equal(rawReference.provenance.copied_private_raw, false);
    assert.equal(rawReference.provenance.import_contract.input_schema, "briefweaver.project-brief.v1");
    assert.match(rawReference.provenance.project_brief, /project-brief\.json$/);
    assert.match(rawReference.provenance.handoff_project_brief, /briefweaver-project-brief\.json$/);
    assert.equal(sourceSafeBundle.includes("Acme Secret Studio"), false);
    assert.equal(sourceSafeBundle.includes("https://secret.example.com/source"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("import-brief-weaver rejects runs missing the frozen project brief contract", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const briefWeaverRun = join(dir, "brief-weaver-runs", "sample-bridge");
    const out = join(dir, "rizzfizz-run");
    await writeBriefWeaverFixture(briefWeaverRun);
    await rm(join(briefWeaverRun, "handoff"), { recursive: true, force: true });

    await assert.rejects(
      execFileAsync("node", [
        cli,
        "import-brief-weaver",
        "--input",
        briefWeaverRun,
        "--out",
        out
      ]),
      /briefweaver-project-brief\.json|ENOENT/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("design-archetype command emits features, probabilities, confidence, and safe variation rules", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const htmlPath = join(dir, "sample.html");
    const cssPath = join(dir, "sample.css");
    const out = join(dir, "archetype.json");
    await writeFile(htmlPath, `<main class="grid gap-4 p-6 md:p-10 text-sm bg-white rounded-xl shadow" data-state="ready"><button class="px-4 py-2 rounded-md hover:bg-slate-50">Go</button></main>`);
    await writeFile(cssPath, `.sr-only { position: absolute; width: 1px; height: 1px; }`);

    const { stdout } = await execFileAsync("node", [cli, "design-archetype", "--html", htmlPath, "--css", cssPath, "--out", out]);
    const result = JSON.parse(await readFile(out, "utf8"));

    assert.match(stdout, /Wrote design archetype:/);
    assert.equal(result.schema, "rizzfizz.design-archetype-report.v1");
    assert.equal(result.classification.schema, "rizzfizz.design-archetype-classification.v1");
    assert.equal(result.primary_archetype.id, "utility-first");
    assert.equal(result.confidence, result.primary_archetype.probability);
    assert.ok(result.feature_vector.utility_class_ratio > 0.5);
    assert.equal(Number(Object.values(result.softmax_distribution).reduce((sum, value) => sum + value, 0).toFixed(6)), 1);
    assert.ok(result.safe_variation_rules.length >= 4);
    assert.match(result.safe_variation_rules.join(" "), /utility classes|responsive states/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("export commands write a-eyes tokens, CSS vars, and agent briefs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", join(dir, "run")]);
    await execFileAsync("node", [cli, "export", "--format", "a-eyes-variant-tokens", "--input", join(dir, "run", "palette-run.json"), "--out", join(dir, "aeyes.json")]);
    await execFileAsync("node", [cli, "export", "--format", "a-eyes-intake-variants", "--input", join(dir, "run"), "--out", join(dir, "variants.json")]);
    await execFileAsync("node", [cli, "export", "--format", "css-vars", "--input", join(dir, "run", "palette-run.json"), "--out", join(dir, "tokens.css")]);
    await execFileAsync("node", [cli, "export", "--format", "agent-brief", "--input", join(dir, "run"), "--out", join(dir, "briefs")]);

    const aeyes = JSON.parse(await readFile(join(dir, "aeyes.json"), "utf8"));
    const intakeVariants = JSON.parse(await readFile(join(dir, "variants.json"), "utf8"));
    const css = await readFile(join(dir, "tokens.css"), "utf8");
    const brief = await readFile(join(dir, "briefs", "variant-1.md"), "utf8");

    assert.equal(aeyes.schema, "rizzfizz.a-eyes-variant-tokens.v1");
    assert.ok(intakeVariants.master_brief.site_goal);
    assert.equal(intakeVariants.shared_constraints.a_eyes_required, true);
    assert.equal(intakeVariants.variants.length, 2);
    assert.ok(intakeVariants.variants[0].palette_relationship.relationship);
    assert.ok(intakeVariants.variants[0].specific_requirements.length > 0);
    assert.match(css, /--paper:/);
    assert.match(brief, /Quality Bar/);
    assert.match(brief, /Implementation Contract/);
    assert.match(brief, /Component Contract/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("tech-scan summarizes Whiffler JSON and scrub-md carries it into briefs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const techContextPath = join(dir, "technology-context.json");
    await execFileAsync("node", [cli, "tech-scan", "--input", waffleFixture, "--out", techContextPath]);
    const techContext = JSON.parse(await readFile(techContextPath, "utf8"));
    assert.equal(techContext.schema, "rizzfizz.technology-context.v2");
    assert.equal(techContext.source_safe, true);
    assert.equal(techContext.scan.url, "redacted");
    assert.equal(techContext.raw_scan, undefined);
    assert.equal(techContext.detected[0].name, "Next.js");
    assert.equal(techContext.detected[0].confidence_label, "high");
    assert.equal(techContext.detected[0].strongest_evidence[0].channel, "scriptSrc");
    assert.equal(techContext.detected[0].strongest_evidence[0].value_kind, "url");

    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "1", "--tech-scan", waffleFixture, "--out", join(dir, "run")]);
    const runTechContext = JSON.parse(await readFile(join(dir, "run", "technology-context.json"), "utf8"));
    const variants = JSON.parse(await readFile(join(dir, "run", "variants.json"), "utf8"));
    const brief = await readFile(join(dir, "run", "builder-briefs", "variant-1.md"), "utf8");
    const previewPath = join(dir, "preview.html");
    await execFileAsync("node", [cli, "preview", "--input", join(dir, "run"), "--out", previewPath]);
    const preview = await readFile(previewPath, "utf8");
    assert.equal(runTechContext.detected[0].name, "Next.js");
    assert.match(
      variants.variants[0].technology_direction.source_technology_context.detected_stack_summary,
      /Next\.js/
    );
    assert.equal(
      variants.variants[0].technology_direction.source_technology_context.top_technologies[0].strongest_evidence[0].value_kind,
      "url"
    );
    assert.match(
      variants.variants[0].technology_direction.source_technology_context.do_not_clone.join(" "),
      /generated framework asset paths/
    );
    assert.match(brief, /Detected Source Technology Context/);
    assert.match(brief, /Waffle Whiffler/);
    assert.match(preview, /Stack Fit Evidence/);
    assert.match(preview, /Strongest Evidence/);
    assert.match(preview, /Do Not Clone/);
    assert.match(preview, /Next\.js 100%/);
    assert.equal(preview.includes("https://example.test"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("tech-scan accepts merged normalized Whiffler technologies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const scanPath = join(dir, "normalized-whiffler.json");
    const techContextPath = join(dir, "technology-context.json");
    await writeFile(scanPath, JSON.stringify({
      url: "https://example.test/private",
      status: 200,
      aggressive: true,
      features: { script_count: 4 },
      technologies: [
        {
          id: "nextjs",
          normalized_name: "Next.js",
          confidence: 0.91,
          categories: [{ name: "JavaScript frameworks" }, "frontend"],
          versions: "14.2.0",
          evidence: {
            scriptSrc: [{ confidence: 0.91, value: "https://example.test/_next/static/chunk.js", pattern: "_next/static" }],
            html: [{ confidence: 0.55, value: "__NEXT_DATA__" }]
          }
        },
        {
          name: "React",
          confidence_score: 18,
          category: "JavaScript frameworks",
          evidence: [{ type: "text", confidence: 18, value: "react" }]
        }
      ]
    }, null, 2));

    await execFileAsync("node", [cli, "tech-scan", "--input", scanPath, "--out", techContextPath]);
    const techContext = JSON.parse(await readFile(techContextPath, "utf8"));

    assert.equal(techContext.detected[0].name, "Next.js");
    assert.equal(techContext.detected[0].confidence, 91);
    assert.deepEqual(techContext.detected[0].versions, ["14.2.0"]);
    assert.ok(techContext.detected[0].categories.includes("JavaScript frameworks"));
    assert.ok(techContext.detected[0].evidence_channels.includes("scriptSrc"));
    assert.equal(techContext.detected[0].strongest_evidence[0].value_kind, "url");
    assert.equal(techContext.weak_signals[0].name, "React");
    assert.equal(techContext.weak_signals[0].categories[0], "JavaScript frameworks");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("tech-scan preserves weak Whiffler evidence without promoting it to detected stack", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const techContextPath = join(dir, "technology-context.json");
    await execFileAsync("node", [cli, "tech-scan", "--input", weakWhifflerFixture, "--out", techContextPath]);
    const techContext = JSON.parse(await readFile(techContextPath, "utf8"));

    assert.equal(techContext.schema, "rizzfizz.technology-context.v2");
    assert.equal(techContext.raw_scan, undefined);
    assert.deepEqual(techContext.detected, []);
    assert.equal(techContext.weak_signals[0].name, "React");
    assert.equal(techContext.weak_signals[0].confidence, 20);
    assert.equal(techContext.weak_signals[0].strongest_evidence[0].value_kind, "text");
    assert.match(techContext.recommendations.detected_stack_summary, /No confident technologies detected/);
    assert.match(techContext.recommendations.stack_fit, /normal RizzFizz stack selector/);
    assert.match(techContext.recommendations.cautions.join(" "), /Weak unpromoted signals/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function writeBriefWeaverFixture(runDir) {
  await mkdir(join(runDir, "raw"), { recursive: true });
  await mkdir(join(runDir, "handoff"), { recursive: true });
  await mkdir(join(runDir, "scrubbed"), { recursive: true });
  await mkdir(join(runDir, "variants"), { recursive: true });
  await mkdir(join(runDir, "palettes"), { recursive: true });
  await writeFile(join(runDir, "raw", "DESIGN-source.md"), "Source URL: https://secret.example.com/source\nSource identity: Acme Secret Studio\n");
  await writeFile(join(runDir, "source-manifest.json"), JSON.stringify({
    source_url: "https://secret.example.com/source",
    source_name: "Acme Secret Studio"
  }, null, 2));
  await writeFile(join(runDir, "variation-manifest.json"), JSON.stringify({
    run_id: "sample-bridge",
    domain: "photography portfolio",
    variant_count: 2,
    locked_traits: ["image_first_hierarchy"],
    varied_traits: ["palette", "technology"],
    outputs: {
      neutral: "scrubbed/DESIGN-neutral.md",
      variants_json: "variants/variants.json",
      palette_run: "palettes/palette-run.json"
    }
  }, null, 2));
  const projectBrief = {
    schemaVersion: "briefweaver.project-brief.v1",
    run_id: "sample-bridge",
    source_safe: true,
    operator_prompt: "Make a premium photographer portfolio with motion and minimal copy.",
    selected_reference_set: [
      {
        reference_id: "sample-source-safe-reference",
        tags: ["photography", "portfolio", "premium"],
        notes: "Source-safe synthesized reference notes.",
        selection_rationale: "Fixture for RizzFizz import."
      }
    ],
    controls: {
      variant_count: 2
    },
    desired_variation_dimensions: ["palette", "technology"],
    scrub_policy: {
      private_exclusions: ["raw/", "source-manifest.json"]
    },
    rizzfizz_import: {
      status: "ready",
      input_schema: "briefweaver.project-brief.v1",
      import_hint: "Import only the frozen source-safe file set.",
      attachments: [
        "variation-manifest.json",
        "project-brief.json",
        "handoff/briefweaver-project-brief.json",
        "scrubbed/DESIGN-neutral.md",
        "scrubbed/scrubbed-design-dna.json",
        "variants/variants.json",
        "palettes/palette-run.json",
        "variants/DESIGN-variant-*.md"
      ],
      private_exclusions: ["raw/", "source-manifest.json"]
    },
    variant_ids: ["variant-1", "variant-2"],
    default_variant: "variant-1"
  };
  await writeFile(join(runDir, "project-brief.json"), JSON.stringify(projectBrief, null, 2));
  await writeFile(join(runDir, "handoff", "briefweaver-project-brief.json"), JSON.stringify(projectBrief, null, 2));
  await writeFile(join(runDir, "scrubbed", "DESIGN-neutral.md"), [
    "# DESIGN-neutral",
    "",
    "Premium photography portfolio with image-first hierarchy, restrained motion, and source-safe abstract layout relationships."
  ].join("\n"));
  await writeFile(join(runDir, "scrubbed", "scrubbed-design-dna.json"), JSON.stringify({
    domain: "photography portfolio",
    design_direction: "Premium photography portfolio with image-first hierarchy.",
    scrubbing_policy: {
      builder_files_exclude: ["source URLs", "source names"],
      preserve: ["layout relationship", "color role relationship"]
    }
  }, null, 2));
  const variants = [1, 2].map((number) => ({
    id: `variant-${number}`,
    domain: "photography portfolio",
    raw_prompt_summary: "Make a premium photographer portfolio with motion and minimal copy.",
    design_direction: "Create a photography portfolio from source-safe design DNA.",
    palette_relationship: {
      relationship: "dark base with layered low-chroma surfaces, high-contrast text, and a restrained blue accent",
      variant_palette_name: `bounded blue dark shift ${number}`,
      generator: "deterministic_hue_family_shift",
      hue_family: "blue",
      hue: number === 1 ? 196 : 207,
      mode: "dark",
      accent_usage: "Keep accent usage under 8% of the visible UI.",
      contrast_checks: {
        text_on_background: 17.93,
        text_on_surface: 14.53,
        muted_text_on_background: 9.82,
        primary_on_background: 15.62,
        accent_on_background: 6.58,
        accent_on_surface: 5.34
      }
    },
    palette_tokens: number === 1 ? bridgeTokensOne() : bridgeTokensTwo(),
    palette_usage: "Keep accent color restrained and reserve it for focus, active states, and one or two signature moments.",
    technology_direction: {
      stack: "static-html-css-js",
      libraries: ["gsap"],
      constraints: ["Respect prefers-reduced-motion."]
    },
    layout_guidance: "Lead with inspectable visual work, not a text-only hero.",
    typography_guidance: "Use role relationships instead of source font names.",
    motion_guidance: "Use motion to clarify hierarchy.",
    avoid_copying: ["source URLs", "source brand names"]
  }));
  await writeFile(join(runDir, "variants", "variants.json"), JSON.stringify({ variants }, null, 2));
  await writeFile(join(runDir, "variants", "DESIGN-variant-1.md"), "Variant 1 source-safe design brief.\n");
  await writeFile(join(runDir, "variants", "DESIGN-variant-2.md"), "Variant 2 source-safe design brief.\n");
  await writeFile(join(runDir, "palettes", "palette-run.json"), JSON.stringify({
    family: "blue",
    generator: "deterministic_hue_family_shift",
    palettes: [
      {
        id: "variant-1",
        name: "bounded blue dark shift -22.0",
        family: "blue",
        hue: 196,
        mode: "dark",
        contrast_checks: variants[0].palette_relationship.contrast_checks,
        tokens: bridgeTokensOne()
      },
      {
        id: "variant-2",
        name: "bounded blue dark shift -11.0",
        family: "blue",
        hue: 207,
        mode: "dark",
        contrast_checks: variants[1].palette_relationship.contrast_checks,
        tokens: bridgeTokensTwo()
      }
    ]
  }, null, 2));
}

function bridgeTokensOne() {
  return {
    background: "#071114",
    surface: "#13272d",
    text: "#f2f9fa",
    muted_text: "#a1bfc7",
    primary: "#d6ecf5",
    accent: "#479af7",
    border: "#2a4952"
  };
}

function bridgeTokensTwo() {
  return {
    background: "#071116",
    surface: "#14252f",
    text: "#f2f7fa",
    muted_text: "#a1b8c7",
    primary: "#d6e7f5",
    accent: "#4779f7",
    border: "#2a4252"
  };
}

test("handoff writes a Pidge payload in dry-run mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "2", "--out", join(dir, "run")]);
    const { stdout } = await execFileAsync("node", [
      cli,
      "handoff",
      "--input",
      join(dir, "run"),
      "--to",
      "gemma",
      "--variant",
      "variant-1",
      "--dry-run",
      "--pidge",
      "/Users/max/Documents/Code/pidge/pidge"
    ]);
    assert.match(stdout, /Wrote pidge payload:/);
    assert.match(stdout, /pidge send/);
    assert.match(stdout, /--attach/);

    const payloadPath = stdout.match(/Wrote pidge payload: (.+)/)?.[1].trim();
    assert.ok(payloadPath);
    const payload = JSON.parse(await readFile(payloadPath, "utf8"));
    assert.equal(payload.schema, "rizzfizz.pidge-handoff.v1");
    assert.equal(payload.variants.length, 1);
    assert.equal(payload.variants[0].id, "variant-1");
    assert.match(payload.source.build_contract, /build-contract\.json$/);
    assert.match(payload.source.visual_tokens, /visual-tokens\.json$/);
    assert.match(payload.source.run_manifest, /run-manifest\.json$/);
    assert.match(payload.source.variants_json, /variants\.json$/);
    assert.equal(payload.source.raw_reference_included, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a-eyes intake sample runner exercises scrub, preview, export, and dry-run handoff", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const out = join(dir, "sample");
    const { stdout } = await execFileAsync("node", [aEyesSampleRunner, "--out", out]);

    assert.match(stdout, /scrub-md/);
    assert.match(stdout, /preview/);
    assert.match(stdout, /a-eyes-intake-variants/);
    assert.match(stdout, /handoff/);
    assert.match(stdout, /--dry-run/);
    assert.match(stdout, /Sample run:/);

    const html = await readFile(join(out, "preview.html"), "utf8");
    const intakeVariants = JSON.parse(await readFile(join(out, "variants.json"), "utf8"));
    const pidgeFiles = await readdir(join(out, "pidge"));
    const payloadFile = pidgeFiles.find((name) => name.endsWith("-a-eyes.json"));
    assert.ok(payloadFile);
    const payload = JSON.parse(await readFile(join(out, "pidge", payloadFile), "utf8"));

    assert.match(html, /RizzFizz static run preview/);
    assert.match(html, /variant-1/);
    assert.equal(html.includes("Meridian Studio"), false);
    assert.equal(html.includes("https://studio.example.invalid/meridian"), false);
    assert.equal(intakeVariants.shared_constraints.a_eyes_required, true);
    assert.equal(intakeVariants.variants.length, 3);
    assert.equal(intakeVariants.variants[0].id, "variant-1");
    assert.ok(intakeVariants.variants[0].palette_tokens.paper);
    assert.equal(payload.routing.kind, "rizzfizz-a-eyes-intake");
    assert.equal(payload.routing.to, "a-eyes");
    assert.equal(payload.variants.length, 3);
    assert.match(payload.source.variants_json, /variants\.json$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("handoff resolves default pidge from PATH", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  try {
    const binDir = join(dir, "bin");
    const fakePidge = join(binDir, "pidge");
    await mkdir(binDir);
    await writeFile(fakePidge, "#!/bin/sh\nprintf 'msg_path_only\\n'\n");
    await chmod(fakePidge, 0o755);

    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "1", "--out", join(dir, "run")]);
    const { stdout } = await execFileAsync("node", [
      cli,
      "handoff",
      "--input",
      join(dir, "run"),
      "--to",
      "gemma",
      "--from",
      "codex",
      "--variant",
      "variant-1"
    ], {
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH || ""}` }
    });

    assert.match(stdout, /Wrote pidge payload:/);
    assert.match(stdout, /msg_path_only/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("handoff can send through real pidge into an isolated bus root", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rizzfizz-test-"));
  const busRoot = join(dir, "bus");
  try {
    await execFileAsync("node", [cli, "scrub-md", "--input", fixture, "--variants", "1", "--out", join(dir, "run")]);
    const { stdout } = await execFileAsync("node", [
      cli,
      "handoff",
      "--input",
      join(dir, "run"),
      "--to",
      "gemma",
      "--from",
      "codex",
      "--variant",
      "variant-1",
      "--pidge",
      "/Users/max/Documents/Code/pidge/pidge",
      "--expects-response"
    ], {
      env: { ...process.env, PIDGE_ROOT: busRoot }
    });
    assert.match(stdout, /msg_/);

    const { stdout: inbox } = await execFileAsync("/Users/max/Documents/Code/pidge/pidge", ["list", "--for", "gemma"], {
      env: { ...process.env, PIDGE_ROOT: busRoot }
    });
    assert.match(inbox, /msg_/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
