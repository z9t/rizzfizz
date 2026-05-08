# High-End AI Website Stack

Status: working guidance  
Date: 2026-05  
Source: operator-provided stack notes

This note defines the sensible default technology guidance for high-end AI-assisted website builds as of May 2026. Use it as RizzFizz for prompt generation, builder assignment, and review criteria.

## Core Things To Learn

- HTML semantics, forms, metadata, and responsive images.
- CSS: Flexbox, Grid, responsive design, container queries, custom properties, and design tokens.
- JavaScript, especially TypeScript.
- Accessibility: WCAG 2.2, keyboard navigation, focus states, and ARIA only when needed.
- Performance: Core Web Vitals, especially LCP, INP, and CLS.
- Design systems: spacing scale, typography scale, color tokens, and reusable components.

## Default AI-Agent Stack

Use this when you want a modern, high-quality site and do not have special constraints:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui components built on Radix primitives
- lucide-react for icons
- Motion for subtle UI animation
- Playwright to verify responsive layout and interactions

Keep accessibility and Core Web Vitals in scope.

Why: React is still the common center of gravity for component-based UI building. Next.js is the standard React meta-framework for full-stack apps. Vite is the lean modern build tool when a full framework is unnecessary. Ecosystem anchors include React, Next.js, Vite, Astro, Vue, Svelte, and current State of JS surveys.

## Best By Website Type

| Website type | Recommended stack |
|---|---|
| Marketing site, blog, documentation | Astro + TypeScript + Tailwind, with React islands only where interactive. Astro is optimized for fast, content-driven websites. |
| SaaS app, dashboard, portal | Next.js + React + TypeScript + Tailwind + shadcn/ui + TanStack Query + React Hook Form + Zod. |
| Highly interactive app | React + Vite or Next.js, plus TanStack Query and Zustand/Jotai if local state gets complex. |
| Visual, immersive, award-style site | Add Motion, GSAP, Three.js, or React Three Fiber. |
| Enterprise/internal UI | Consider MUI, Ant Design, or Angular if organization conventions matter more than bespoke visual polish. |

## Libraries Worth Knowing

| Area | Libraries |
|---|---|
| UI primitives | Radix UI, Base UI, Headless UI |
| Component systems | shadcn/ui, MUI, Chakra UI, Ant Design |
| Styling | Tailwind CSS, CSS variables, CSS Modules, Sass only when inherited |
| Animation | Motion, GSAP, CSS transitions/keyframes |
| Data | TanStack Query, SWR |
| Tables | TanStack Table |
| Forms/validation | React Hook Form, Zod |
| Charts | Recharts, D3, ECharts |
| Icons | lucide-react |
| Testing/QA | Playwright, Vitest, Testing Library, Storybook, axe |
| Build/deploy | Vite, Next.js, Astro, Vercel, Netlify, Cloudflare Pages |

## Prompt Pattern

Use this when asking a high-end AI agent to build a website:

```text
Build a production-quality responsive website using Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Radix primitives, lucide-react icons, and Motion for restrained animation.

Prioritize semantic HTML, WCAG 2.2 AA accessibility, keyboard navigation, visible focus states, responsive layouts, strong typography, design tokens, reusable components, and Core Web Vitals.

Do not make a generic landing page. Build the actual usable experience. Verify desktop and mobile with Playwright screenshots. Fix text overflow, layout shifts, inaccessible controls, and visual inconsistencies before finishing.
```

## Useful Source Anchors

- React docs
- Next.js docs
- Vite docs
- State of JS 2024
- Tailwind utility classes
- shadcn/ui
- Radix primitives
- Motion
- WCAG overview
- Core Web Vitals

## a-eyes Pipeline Notes

- For first-run static-site experiments, the full default stack may be too heavy. Use plain HTML/CSS/JS when the test is about agent routing, visual iteration, or a-eyes capture.
- For serious production-quality variants, include the stack choice in the intake brief before agents start coding.
- Do not let builders choose color systems entirely from scratch when palette direction matters. Provide palette tokens or a constrained palette relationship.
- Use Playwright checks as part of the quality gate for any build that claims to be responsive or production-quality.
- Keep Motion/GSAP/Three.js use tied to the site type. Subtle UI motion is default; immersive animation needs an explicit brief.
