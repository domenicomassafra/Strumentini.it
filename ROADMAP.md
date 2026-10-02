# ROADMAP

Current stage: **real implementation hardening and catalog certification**.

Checkpoint 2026-10-03: 200 tools exist, 119 are Gold/release-eligible, 1 is Partial, 80 are implemented but intentionally still unverified. The full automated suite is green (334/334 across 48 test files), `astro check` is clean, and the static build produces 204 pages. Public-facing copy is Italian-primary, with a small number of source-level UI strings still identified for cleanup. The next visual tranche should be a deliberate UI/UX redesign rather than incremental polish.

## P0 — close the current Italian/backend tranche

- keep the 200/200 Italian public-copy gate mandatory in Tool Factory generation;
- keep shell, onboarding, Workbench, tool forms, results and error states free of accidental English UI copy;
- keep human naming, semantic icons, visible categories and quality status centralized rather than reimplemented per component;
- keep `Verificato` tied to actual Gold eligibility; never use the visual badge as a marketing-only label;
- keep browser route smoke and representative operation smoke as acceptance evidence when changing shared UI/runtime layers;
- preserve protocol/standard identifiers only where translating them would be technically incorrect (for example JSON, CSV, JWT, UUID, Open Graph);
- keep `npm test`, `npm run check`, `npm run build`, catalog generation and certification checks green;
- commit the current tranche only after generated catalog and certification receipts are deterministic and current;
- keep `image-resize` Partial until genuine physical-device evidence exists; never infer physical Safari/Android evidence from desktop or emulation.

## P1 — make the remaining 80 unverified tools genuinely trustworthy

- work family by family rather than promoting tools in bulk;
- add independent fixtures/oracles for each family before Gold certification;
- exercise malformed inputs, limits, deterministic edge cases and privacy/network contracts;
- verify that displayed result copy is Italian without altering machine-readable standards output;
- add browser acceptance where the tool depends on browser APIs, files, images, PDF, canvas, clipboard or downloads;
- strengthen reference-backed tools with explicit source provenance, freshness rules and fail-closed behavior;
- prioritize broadly useful jobs instead of increasing raw catalog count beyond 200.

Current remaining frontier by engine: `research-knowledge` 20, `file-privacy` 19, `image` 14, `url-marketing` 12, `image-visual` 5, `text-writing` 4, `marketing-math` 3, `qr-local` 2, `date-time` 1. The PDF/document family is already Gold and is not part of the remaining frontier.

## P2 — deepen the product backend and discovery model

- improve search ranking around tasks, accepted inputs, categories, professional contexts and handoffs;
- improve shared Profile defaults and typed handoff contracts between compatible tools;
- make catalog metadata and result schemas useful to both the UI and future programmatic/agent consumers;
- expand deterministic Italian reference data where it creates real utility, with versioning and reproducible updates;
- keep local-first execution as the default and require an explicit contract for every networked/reference-backed capability;
- keep configuration portability, privacy boundaries, performance budgets and lazy loading covered by tests.

## P3 — redesign UI/UX after the backend is stable

- redesign the visual system rather than polishing the current shell incrementally;
- validate home/Workbench information hierarchy, Library discovery and mobile interaction with the mature catalog;
- keep the product focused on finding and completing a task quickly, not on showing a wall of 200 cards;
- preserve the Italian-first content system during the redesign instead of reintroducing per-component copy.

## P4 — release and distribution

- rerun full release validation on the final committed tree;
- verify production deployment, rollback evidence, canonical URLs, sitemap/robots and analytics/privacy behavior;
- only claim catalog size using the distinction between implemented and Gold-certified tools;
- evaluate optional sync/auth and monetization only when they solve a demonstrated user need rather than increasing infrastructure by default.

## Stop rules

Do not mark a tool Gold because it merely renders or has a route. Do not replace missing evidence with assumptions. Do not grow catalog size if regression rate, maintenance cost, initial bundle size or evidence debt rises faster than user value. Keep server-side/LLM dependencies exceptional rather than the normal execution path.
