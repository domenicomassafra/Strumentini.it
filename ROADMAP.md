# ROADMAP

Current stage: **real implementation hardening and catalog certification**.

Checkpoint 2026-10-04: 200 tools exist, 177 are verified against a recorded oracle, 1 is Partial (`image-resize`) and 22 are implemented but intentionally still unverified. Google sign-in/linking and the mobile auth/catalog/settings pass are implemented and deployed fail-closed pending the real Google Web Client ID. `npm test` is green (371 tests / 52 files), `astro check` is 0/0/0 across 1197 files, auth acceptance is 130/130, and the static build remains 220 pages. All 177 Gold receipts are rebound to the current source fingerprint; the browser matrix and the rollback receipt are whole-tree artifacts that the merge must regenerate.

## P0 — close the current Italian/backend tranche

- keep the 200/200 Italian public-copy gate mandatory in Tool Factory generation;
- keep the shell, onboarding, catalogue, tool forms, results and error states free of accidental English UI copy;
- keep human naming, semantic icons, visible categories and quality status centralized rather than reimplemented per component;
- keep `Verificato` tied to real certification eligibility; never use the badge as a marketing-only label, and keep the internal "Gold" label out of public copy;
- keep browser route smoke and representative operation smoke as acceptance evidence when changing shared UI/runtime layers;
- preserve protocol/standard identifiers only where translating them would be technically incorrect (for example JSON, CSV, JWT, UUID, Open Graph);
- keep `npm test`, `npm run check`, `npm run build`, catalog generation and certification checks green;
- keep the closed redesign/backend tranche immutable while certification evidence is current; any new source edit starts a new fingerprinted tranche;
- keep `image-resize` Partial until genuine physical-device evidence exists; never infer physical Safari/Android evidence from desktop or emulation.

## P1 — make the remaining 23 non-Gold tools genuinely trustworthy

- work family by family rather than promoting tools in bulk;
- add independent fixtures/oracles for each family before Gold certification;
- exercise malformed inputs, limits, deterministic edge cases and privacy/network contracts;
- verify that displayed result copy is Italian without altering machine-readable standards output;
- add browser acceptance where the tool depends on browser APIs, files, images, PDF, canvas, clipboard or downloads;
- strengthen reference-backed tools with explicit source provenance, freshness rules and fail-closed behavior;
- prioritize broadly useful jobs instead of increasing raw catalog count beyond 200.

Current remaining frontier by engine: `research-knowledge` 14, `url-marketing` 4, `image` 2, `qr-local` 2, `image-visual` 1. The 23-tool non-Gold frontier is 22 implemented-unverified tools plus the one Partial `image-resize`. `file-privacy`, `text-writing`, `date-time` and the PDF/document family are already Gold; the nine-tool `local-jobs` tranche that closed the first three ships six new independent fixture families and a certifier that replays them through the public tool modules.

## P2 — deepen the product backend and discovery model

- improve search ranking around tasks, accepted inputs, categories, professional contexts and handoffs;
- improve shared Profile defaults and typed handoff contracts between compatible tools;
- make catalog metadata and result schemas useful to both the UI and future programmatic/agent consumers;
- expand deterministic Italian reference data where it creates real utility, with versioning and reproducible updates;
- keep local-first execution as the default and require an explicit contract for every networked/reference-backed capability;
- keep configuration portability, privacy boundaries, performance budgets and lazy loading covered by tests.

## P3 — redesign UI/UX after the backend is stable — **shipped**

- ~~redesign the visual system rather than polishing the current shell incrementally~~ — done: `design/WORLD.md` plus `src/styles/global.css`;
- ~~validate home information hierarchy, catalogue discovery and mobile interaction with the mature catalog~~ — done: `/`, `/strumenti/`, `/cerca/`, `/categorie/` and the 390px pass;
- keep the product focused on finding and completing a task quickly, not on showing a wall of 200 cards;
- preserve the Italian-first content system during the redesign instead of reintroducing per-component copy.

## P4 — release and distribution

- rerun full release validation on the final committed tree;
- verify production deployment, rollback evidence, canonical URLs, sitemap/robots and analytics/privacy behavior;
- only claim catalog size using the distinction between implemented and Gold-certified tools;
- evaluate optional sync/auth and monetization only when they solve a demonstrated user need rather than increasing infrastructure by default.

## Stop rules

Do not mark a tool Gold because it merely renders or has a route. Do not replace missing evidence with assumptions. Do not grow catalog size if regression rate, maintenance cost, initial bundle size or evidence debt rises faster than user value. Keep server-side/LLM dependencies exceptional rather than the normal execution path.
