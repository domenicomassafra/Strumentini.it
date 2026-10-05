# ROADMAP

Current stage: **198/200 certified + frontend-system consolidation**.

Checkpoint 2026-10-05: 200 tools exist; **198 are Gold**, `image-resize` is **Partial**, and `ris-bibtex-converter` is the **only Implemented Unverified** tool. `npm test` is green at **592 tests / 55 files**; `astro check` is **0/0/0 across 1216 files**; the static build remains **220 pages**. Research, local-jobs and marketing/media browser acceptance all pass on the combined tree.

## P0 — preserve the quality contract

- keep all 200 normal tools `LOCAL` with network forbidden unless a future tool explicitly declares a different contract;
- keep public quality vocabulary `Verificato` / `In verifica` tied to the machine certification index;
- do not weaken validators, invent external evidence or call emulation a physical-device pass;
- keep `npm test`, `npm run check`, `npm run build`, catalog generation and certification checks green;
- prioritize fixing real defects over adding catalog count.

## P1 — close the final two non-Gold boundaries

- **`ris-bibtex-converter`**: browser acceptance already passes; promote only after an acceptable RIS authority / independent parser cross-check closes oracle `cand-187` honestly;
- **`image-resize`**: automated certification passes; collect genuine iOS Safari and Android Chrome receipts before Gold;
- no synthetic receipts, no desktop emulation as physical proof.

## P2 — standardize the frontend without flattening it

Use `design/FRONTEND-SYSTEM-STANDARDIZATION.md` as the implementation plan. The Impeccable audit found extensive duplication and drift (including repeated field/control/state/card patterns), but the right solution is **one existing design system consolidated**, not a second component library.

Migration principles:

- standardize primitives first: fields, actions, result/state treatment, cards, pagination and common accessibility semantics;
- centralize tokens and recurring interaction states rather than copying CSS per surface;
- migrate family renderers progressively and verify each wave against the approved reference screens;
- keep homepage, catalog/discovery, tool workspace and account/onboarding compositions distinct where their jobs differ;
- leave higher-risk shell/file-drop refactors until low-risk primitives are stable;
- every wave gets unit/design-system tests plus browser/mobile screenshot/interaction gates.

## P3 — deepen discovery and workspace usefulness

- improve search ranking around jobs, inputs, categories, professional contexts and handoffs;
- improve shared profile defaults and typed handoff contracts;
- expand deterministic Italian reference data only where it creates real utility and can be versioned/reproduced;
- keep configuration portability, privacy boundaries, performance budgets and lazy loading covered by tests.

## P4 — release and distribution

- refresh whole-tree browser-performance evidence on the final tree;
- refresh rollback evidence only through a real deploy → rollback → smoke → restore exercise;
- connect the custom domain before adding outer Cloudflare WAF rate limiting;
- configure the real Google Web Client ID and confirm Workers Paid before relying on password auth at production load;
- keep catalog-size claims separate from certification claims.

## P5 — future catalog expansion + Result System v2

After the current release/certification frontier and frontend-system consolidation are protected, execute the approved future plan in `docs/10-tool-expansion-result-system-v2.md` through the tracked 46-ticket DAG in `.scratch/strumentiutili-expansion-20261005/`. Only the dependency-free start frontier (01, 07, 34) is ready until its blockers are actually closed.

- migrate all 200 current tools to the answer-first Result System v2 with explicit 200/200 coverage proof;
- cover all 13 current CalcolaTutto jobs via add/upgrade/covered mappings;
- expand into high-value conversions, Italy utilities, Office/spreadsheet interchange, PDF/privacy workflows, developer/security, AI-era deterministic helpers, and capability-gated audio/video;
- treat annual fiscal rules as versioned sourced data and remote authoritative checks as explicit network operations;
- keep the no-vanity-count rule: a route exists for a real user job, not to inflate the catalog.

## Stop rules

Do not mark a tool Gold because it renders. Do not replace missing evidence with assumptions. Do not grow catalog size if regression rate, maintenance cost or evidence debt rises faster than user value. Do not standardize visually different product surfaces merely to reduce component count.
