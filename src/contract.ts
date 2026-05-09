import { technologyDirectionForVariant } from "./exports.js";
import type { BuildContract, LayoutContract, MotionContract, PaletteRun, RawReference, VisualQaContract } from "./types.js";
import type { TechnologyContext } from "./technology.js";

export function buildBuildContract(options: {
  scrubbedText: string;
  paletteRun: PaletteRun;
  rawReference: RawReference;
  technologyContext?: TechnologyContext;
  createdAt?: string;
}): BuildContract {
  const text = options.scrubbedText;
  const relationship = options.paletteRun.relationship;
  return {
    schema: "rizzfizz.build-contract.v1",
    created_at: options.createdAt || new Date().toISOString(),
    source_safe: true,
    source_reference_ids: [options.rawReference.source_locator],
    entrypoint: "Use this contract first. Treat raw-reference.json as private and do not forward it to builders.",
    intent: {
      site_type: inferSiteType(text, relationship),
      primary_job: inferPrimaryJob(text, relationship),
      secondary_jobs: inferSecondaryJobs(text, relationship),
      audience: inferAudience(text, options.technologyContext),
      content_posture: inferContentPosture(text)
    },
    layout: buildLayoutContract(text, relationship),
    components: {
      required: buildRequiredComponents(text, relationship),
      optional: buildOptionalComponents(text, relationship)
    },
    motion: buildMotionContract(text, relationship),
    visual_qa: buildVisualQaContract(relationship),
    avoid: [
      "Do not use source names, URLs, distinctive slogans, proprietary font names, or clone language.",
      "Do not make a generic landing page when the contract describes a usable tool, gallery, dashboard, or app surface.",
      "Do not bury the primary workflow below decorative hero content.",
      "Do not use animation that hides content, blocks interaction, or causes layout shift.",
      "Do not invent a new palette; use the selected variant tokens and usage rules."
    ],
    variants: options.paletteRun.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      palette_tokens: variant.tokens,
      palette_relationship: variant.palette_relationship,
      palette_usage: variant.palette_usage,
      technology_direction: technologyDirectionForVariant(variant),
      visual_rules: visualRulesForRelationship(variant.strategy)
    }))
  };
}

function buildLayoutContract(text: string, relationship: string): LayoutContract {
  const lower = text.toLowerCase();
  const dense = lower.includes("dashboard") || lower.includes("table") || lower.includes("dense");
  const gallery = relationship === "gallery-neutral" || lower.includes("gallery") || lower.includes("portfolio") || lower.includes("image-first");
  const product = relationship === "product-clear";
  const immersive = relationship === "immersive-chroma";
  return {
    first_viewport: immersive
      ? "Show the actual interactive or visual experience immediately, with navigation and a clear next action visible."
      : gallery
        ? "Lead with inspectable visual work or media, not a text-only hero; keep the next section partially visible."
        : product
          ? "Lead with the main product workflow or dashboard summary, not a marketing wrapper."
          : "Lead with the primary usable experience and a clear content path.",
    navigation: dense
      ? "Compact, predictable navigation with clear current state and no hover-only controls."
      : "Simple responsive navigation with visible active/focus states.",
    regions: [
      {
        id: "primary-surface",
        purpose: product ? "Main workflow or product state" : gallery ? "Primary visual inspection area" : "Main content experience",
        density: dense ? "dense but organized" : gallery ? "spacious and image-led" : "moderate",
        notes: [
          "Make the primary purpose visible without scrolling.",
          "Keep labels and controls aligned to a stable grid.",
          "Use tokenized surfaces and borders instead of decorative containers."
        ]
      },
      {
        id: "supporting-detail",
        purpose: "Context, metadata, feature detail, or secondary content",
        density: dense ? "scan-friendly" : "balanced",
        notes: [
          "Use repeated components only when they represent repeated data or choices.",
          "Avoid nesting cards inside cards.",
          "Keep text sizing appropriate to the panel or section size."
        ]
      },
      {
        id: "action-feedback",
        purpose: "Interaction states, confirmations, errors, and loading feedback",
        density: "compact",
        notes: [
          "Provide visible keyboard focus.",
          "Use recoverable error language.",
          "Keep state changes from shifting layout."
        ]
      }
    ],
    responsive_rules: [
      "Verify around 390px mobile and desktop widths.",
      "No clipped labels, overlapping text, or controls that resize on hover.",
      "Use container-aware layout for fixed-format boards, grids, toolbars, and counters.",
      "Preserve the primary workflow on mobile instead of replacing it with a marketing summary."
    ]
  };
}

function buildRequiredComponents(text: string, relationship: string): BuildComponent[] {
  const lower = text.toLowerCase();
  const components: BuildComponent[] = [
    {
      name: "navigation",
      purpose: "Orient users and expose the primary path.",
      states: ["default", "active", "focus", "mobile"],
      constraints: ["Use semantic links or buttons.", "Current state must be visible without relying on color alone."]
    },
    {
      name: "primary-action",
      purpose: "Expose the main action or next step.",
      states: ["default", "hover", "focus", "pressed", "disabled"],
      constraints: ["Use accent token sparingly.", "Meet body text contrast when text appears on action surfaces."]
    },
    {
      name: "content-card-or-panel",
      purpose: "Group repeated content, media, controls, or details.",
      states: ["default", "hover/focus when interactive"],
      constraints: ["Do not nest cards inside cards.", "Use stable dimensions for repeated items."]
    }
  ];
  if (relationship === "product-clear" || lower.includes("form") || lower.includes("dashboard")) {
    components.push({
      name: "form-or-control-set",
      purpose: "Let users manipulate the main workflow.",
      states: ["empty", "filled", "focus", "error", "success", "disabled"],
      constraints: ["Use labels, not placeholder-only fields.", "Errors must explain recovery."]
    });
  }
  if (relationship === "gallery-neutral" || lower.includes("gallery") || lower.includes("portfolio")) {
    components.push({
      name: "media-grid",
      purpose: "Present visual work for scanning and inspection.",
      states: ["loaded", "loading", "hover/focus", "selected"],
      constraints: ["Use real or placeholder-safe media with stable aspect ratios.", "Do not crop important subject matter unpredictably."]
    });
  }
  if (relationship === "immersive-chroma" || lower.includes("animation") || lower.includes("3d")) {
    components.push({
      name: "motion-stage",
      purpose: "Host canvas, WebGL, or timeline-driven visual interaction when justified.",
      states: ["loading", "ready", "reduced-motion"],
      constraints: ["Core content must remain accessible without the effect.", "Provide a reduced-motion fallback."]
    });
  }
  return components;
}

type BuildComponent = {
  name: string;
  purpose: string;
  states: string[];
  constraints: string[];
};

function buildOptionalComponents(text: string, relationship: string): string[] {
  const lower = text.toLowerCase();
  const optional = ["breadcrumbs when hierarchy is deep", "filters when browsing many items", "inline status messages for asynchronous work"];
  if (relationship === "immersive-chroma" || lower.includes("3d")) optional.push("canvas/WebGL background only when it supports the primary experience");
  if (lower.includes("data") || lower.includes("chart")) optional.push("charts with labeled axes, accessible legends, and tokenized data colors");
  return optional;
}

function buildMotionContract(text: string, relationship: string): MotionContract {
  const lower = text.toLowerCase();
  const immersive = relationship === "immersive-chroma" || lower.includes("webgl") || lower.includes("3d");
  const expressive = immersive || lower.includes("cinematic") || lower.includes("animation");
  const level = immersive ? "immersive" : expressive ? "expressive" : "subtle";
  const allowed = immersive
    ? ["CSS transitions", "Motion", "GSAP timeline", "Three.js for real 3D only"]
    : expressive
      ? ["CSS transitions", "Motion", "GSAP for sequenced reveals"]
      : ["CSS transitions", "Motion for small state transitions"];
  return {
    level,
    allowed_techniques: allowed,
    patterns: [
      {
        name: "page_enter",
        trigger: "initial render after content is available",
        duration_ms: [180, expressive ? 700 : 360],
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        constraints: ["Do not delay readable content.", "Avoid animating layout dimensions."]
      },
      {
        name: "section_reveal",
        trigger: "first scroll into view",
        duration_ms: [180, expressive ? 600 : 320],
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        constraints: ["Use small opacity/transform changes only.", "Stagger repeated items by no more than 60ms."]
      },
      {
        name: "interactive_feedback",
        trigger: "hover, focus, press, selection, loading, or data update",
        duration_ms: [90, 220],
        easing: "ease-out",
        constraints: ["Never move text enough to impair reading.", "Focus state must be instant and visible."]
      }
    ],
    reduced_motion: immersive
      ? "Replace canvas or timeline motion with a static tokenized composition and keep all content/actions available."
      : "Disable entrance/reveal transforms and keep essential state changes instant or near-instant.",
    performance_budget: [
      "Prefer opacity and transform animations.",
      "Avoid animating width, height, top, left, or expensive filters on large surfaces.",
      "No animation may block interaction with primary controls.",
      "Verify mobile layout and effect framing."
    ]
  };
}

function buildVisualQaContract(relationship: string): VisualQaContract {
  return {
    screenshots: [
      "desktop viewport around 1440px wide",
      "mobile viewport around 390px wide",
      relationship === "immersive-chroma" ? "short capture or frame check proving the effect renders" : "state screenshot for hover/focus or active controls"
    ],
    checks: [
      "Primary workflow is visible in the first viewport.",
      "No text is clipped, overlapping, or hidden by animation.",
      "Palette tokens are used consistently for surfaces, text, actions, lines, and focus.",
      "Keyboard focus is visible and not obscured.",
      "Responsive layout preserves the main user task."
    ],
    fail_if: [
      "The result is a generic landing page instead of the described experience.",
      "The design copies source identity, brand names, distinctive phrases, or proprietary font names.",
      "Motion hides content, causes layout shift, or lacks a reduced-motion fallback.",
      "Accent color is used as a blanket theme instead of a controlled emphasis."
    ]
  };
}

function inferSiteType(text: string, relationship: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("dashboard") || lower.includes("saas") || relationship === "product-clear") return "product or SaaS interface";
  if (lower.includes("portfolio") || lower.includes("gallery") || relationship === "gallery-neutral") return "portfolio or gallery experience";
  if (lower.includes("documentation") || lower.includes("blog") || lower.includes("editorial")) return "content or editorial site";
  if (relationship === "immersive-chroma") return "immersive visual website";
  return "premium website experience";
}

function inferPrimaryJob(text: string, relationship: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("dashboard")) return "Help users scan current state and take the next operational action.";
  if (lower.includes("gallery") || lower.includes("portfolio") || relationship === "gallery-neutral") return "Let users inspect visual work quickly and move through examples with low friction.";
  if (relationship === "product-clear") return "Let users understand and use the product workflow immediately.";
  if (relationship === "immersive-chroma") return "Deliver an immersive visual experience without hiding the core content or action.";
  return "Communicate the core offer or experience clearly and make the next action obvious.";
}

function inferSecondaryJobs(text: string, relationship: string): string[] {
  const jobs = ["Support quick scanning.", "Make interaction states and feedback clear.", "Preserve source-safe design traits without copying identity."];
  if (relationship === "gallery-neutral" || text.toLowerCase().includes("image")) jobs.push("Let imagery or visual examples carry the composition.");
  if (relationship === "product-clear" || text.toLowerCase().includes("form")) jobs.push("Keep controls ergonomic for repeated use.");
  if (relationship === "immersive-chroma") jobs.push("Provide a meaningful non-animated fallback.");
  return jobs;
}

function inferAudience(text: string, technologyContext?: TechnologyContext): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("developer") ||
    technologyContext?.recommendations.detected_stack_summary.toLowerCase().includes("react")
  ) return "technical users and builders";
  if (lower.includes("customer") || lower.includes("client")) return "prospective customers or clients";
  if (lower.includes("portfolio") || lower.includes("gallery")) return "visual evaluators browsing work";
  return "humans evaluating or using the generated website";
}

function inferContentPosture(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("minimal") || lower.includes("quiet")) return "minimal copy with strong visual hierarchy";
  if (lower.includes("dense") || lower.includes("dashboard")) return "dense but organized information";
  if (lower.includes("editorial") || lower.includes("reading")) return "reading-first editorial flow";
  return "concise, purposeful content with visible next steps";
}

function visualRulesForRelationship(relationship: string): string[] {
  if (relationship === "product-clear") {
    return [
      "Use bright surfaces, clear dividers, and action color for controls and focus.",
      "Keep operational information dense but readable.",
      "Prefer familiar controls over decorative bespoke UI."
    ];
  }
  if (relationship === "gallery-neutral") {
    return [
      "Let media and typography lead the composition.",
      "Use accent only for navigation, links, focus, and one subtle callout.",
      "Use stable image aspect ratios and quiet captions."
    ];
  }
  if (relationship === "immersive-chroma") {
    return [
      "Use luminous accents as focal energy, not across every section.",
      "Keep body copy legible on dark surfaces.",
      "Use canvas or 3D only when it supports the primary experience."
    ];
  }
  if (relationship === "light-editorial-accent") {
    return [
      "Prioritize typography, reading comfort, and restrained accents.",
      "Use generous but not empty whitespace.",
      "Avoid heavy animation around body text."
    ];
  }
  return [
    "Keep the dark base dominant and surfaces low-chroma.",
    "Use accent only for links, focus, active controls, and one key callout.",
    "Preserve contrast and avoid decorative color flooding."
  ];
}
