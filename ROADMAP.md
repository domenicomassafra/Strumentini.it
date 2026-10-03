# ROADMAP

Current stage: **real implementation hardening and catalog certification**.

Checkpoint 2026-10-03: 200 tools exist, 168 are verified against a recorded oracle, 1 is Partial (`image-resize`) and 31 are implemented but intentionally still unverified. The visual redesign has shipped: the ledger-era shell, the old `Workbench` page and the old `/library/` discovery page are gone, replaced by a shell, catalogue, search, category and account surfaces built on one token sheet. `npm test` is green (340 tests), `astro check` reports 0 errors across 1191 files, and the static build produces 220 pages. Public-facing copy is Italian-primary. What is *not* current is the certification evidence: the per-tool receipts bind to a source fingerprint, so the redesign invalidated them and they must be regenerated family by family with the `gold:*` scripts (see `HANDOFF.md` §5).

## P0 — close the current Italian/backend tranche

- keep the 200/200 Italian public-copy gate mandatory in Tool Factory generation;
- keep the shell, onboarding, catalogue, tool forms, results and error states free of accidental English UI copy;
- keep human naming, semantic icons, visible categories and quality status centralized rather than reimplemented per component;
- keep `Verificato` tied to real certification eligibility; never use the badge as a marketing-only label, and keep the internal "Gold" label out of public copy;
- keep browser route smoke and representative operation smoke as acceptance evidence when changing shared UI/runtime layers;
- preserve protocol/standard identifiers only where translating them would be technically incorrect (for example JSON, CSV, JWT, UUID, Open Graph);
- keep `npm test`, `npm run check`, `npm run build`, catalog generation and certification checks green;
- commit the current tranche only after generated catalog and certification receipts are deterministic and current;
- keep `image-resize` Partial until genuine physical-device evidence exists; never infer physical Safari/Android evidence from desktop or emulation.

## P1 — make the remaining 32 non-Gold tools genuinely trustworthy

- work family by family rather than promoting tools in bulk;
- add independent fixtures/oracles for each family before Gold certification;
- exercise malformed inputs, limits, deterministic edge cases and privacy/network contracts;
- verify that displayed result copy is Italian without altering machine-readable standards output;
- add browser acceptance where the tool depends on browser APIs, files, images, PDF, canvas, clipboard or downloads;
- strengthen reference-backed tools with explicit source provenance, freshness rules and fail-closed behavior;
- prioritize broadly useful jobs instead of increasing raw catalog count beyond 200.

Current remaining frontier by engine: `research-knowledge` 14, `file-privacy` 4, `text-writing` 4, `url-marketing` 4, `image` 2, `qr-local` 2, `date-time` 1, `image-visual` 1. The 32-tool non-Gold frontier is 31 implemented-unverified tools plus the one Partial `image-resize`; the PDF/document family is already Gold.

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
