# RizzFizz Gap Analysis & Roadmap
# Date: 2026-05-21
# Based on: Redkey client portfolio audit (18 sites) + Findings survey

## Current State

**What it does:** JSON reformatter. `tech-scan` reads whiffler-scan.json, 
outputs rizzfizz-tech-context.json. On all 18 Redkey sites, the output was 
identical boilerplate with empty summaries.

**The pipeline:**
```
Whiffler → whiffler-scan.json → RizzFizz tech-scan → technology-context.json → a-eyes
```

RizzFizz sits in the middle of the pipeline but currently adds zero net 
information. It's a passthrough with reformatting.

**What it should do:** The START-HERE.md describes an ambitious design 
intelligence pipeline (ingest → scrub → palette → variants → export). 
But the `tech-scan` command — the one actually used in the agent pipeline — 
was added as a bridge and was never given real analytical capability.

## Distance from Shared Dictionary

| Dimension | Current | Target | Gap |
|---|---|---|---|
| Tech analysis | Empty summaries | Framework classification, version detection | ~300 lines |
| Design archetypes | Not implemented | 9-feature → softmax classifier | ~200 lines (from Findings) |
| Stack health scoring | None | Score per category (security, perf, SEO) | ~150 lines |
| Stack recommendations | None | "Missing X, consider Y" generation | ~200 lines |
| Shared vocabulary | None with whiffler beyond JSON passthrough | Share tech IDs/names with whiffler | Format alignment |
| Output value to pipeline | Zero | Actionable stack assessment for a-eyes | Core mission |

## Roadmap

### Phase 1: Make tech-scan actually analyze (1 session)

Instead of JSON reformatting, `tech-scan` should:

1. **Classify the stack** — framework (Next.js/Remix/Nuxt/etc), hosting (Vercel/Netlify/CF), CMS, auth, analytics
2. **Score health** — security headers present? SSL valid? noindex tag? Perf indicators?
3. **Identify gaps** — "No analytics detected" / "Missing security headers" / "Preview deployment"
4. **Generate summary** — 2-3 sentence stack description an agent can use

**Code location:** `src/commands/techScan.ts` (or wherever `tech-scan` is implemented)

### Phase 2: Design archetype classifier (1 session)

From the Findings document — 9 features → softmax classifier:
1. Extract design features from whiffler output + site content
2. Classify into archetypes (corporate, ecommerce, portfolio, SaaS, landing, etc.)
3. Use classification to guide palette generation in other rizzfizz commands

### Phase 3: Full pipeline integration (1 session)

1. `tech-scan` output enriched for a-eyes consumption
2. Motion/animation indicators from the stack
3. Builder-ready handoff: "This is a Next.js site on Vercel with Auth.js, 
   missing analytics. Design archetype: corporate (82% confidence)."

## Prompt for Phase 1

```text
You are upgrading RizzFizz's tech-scan command. Currently it reads 
whiffler-scan.json and outputs boilerplate with empty summaries.

Read the current implementation in src/commands/techScan.ts (or wherever
the tech-scan command lives — find it first).

The command should now:

1. PARSE whiffler-scan.json for technologies, features, headers
2. CLASSIFY into categories:
   - framework: "Next.js" | "Remix" | "Nuxt" | "Vue" | "React" | "Astro" | "Unknown"
   - hosting: "Vercel" | "Netlify" | "Cloudflare" | "Shopify" | "Self-hosted" | "Unknown"
   - cms: "None" | "Sanity" | "Contentful" | "Strapi" | "WordPress" | "Unknown"
   - auth: "Auth.js" | "Clerk" | "Auth0" | "None detected"
   - analytics: "GA4" | "GTM" | "Plausible" | "None detected"
   - css: "Tailwind" | "Bootstrap" | "Chakra" | "shadcn/ui" | "Unknown"
3. SCORE health (0-100):
   - security: -20 if no HSTS, -20 if no CSP, -10 if no X-Frame-Options
   - deployment: -50 if auth wall, -50 if deployment error, -20 if noindex
   - performance: -10 if >500KB HTML, -10 if >20 scripts
4. GENERATE a 2-3 sentence summary an AI agent can read and act on
5. FLAG issues: "Vercel auth wall", "noindex tag", "missing analytics", etc.

Write the new output to the same contract shape but with actual data
instead of empty strings.

Test against the fixtures in test/fixtures/ and the Redkey audit data
in /Users/max/Documents/redkey-audit/clients/*/whiffler-scan.json.

Run `npm test` and `npm run build` when done.
```
