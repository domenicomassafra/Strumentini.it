# ROADMAP

Current stage: **257/259 Gold + final physical/infrastructure closure**.

Checkpoint 2026-10-07: 259 tools exist; **257 are Gold** and only `image-resize` plus `microphone-recorder` remain **Partial** for genuine physical-device evidence. `password-strength-estimator` and `xml-formatter-validator` now have bounded high-confidence oracle evidence and Gold receipts. The integrated suite is green at **1,091 tests / 133 files**; `astro check` reports **0 errors / 0 warnings** (16 deprecation hints in tests), and the static build emits **279 pages** with build inspection PASS.

## P0 — preserve the quality contract

- keep normal local tools `LOCAL` with network forbidden unless a tool explicitly declares a different contract;
- keep public quality vocabulary `Verificato` / `In verifica` tied to the machine certification index;
- do not weaken validators, invent external evidence or call emulation a physical-device pass;
- keep `npm test`, `npm run check`, `npm run build`, catalog generation and certification checks green;
- prioritize fixing real defects over adding catalog count.

## P1 — close the final two non-Gold boundaries

- **`image-resize`**: automated certification passes; collect genuine iOS Safari and Android Chrome receipts before Gold;
- **`microphone-recorder`**: desktop/browser automation passes; collect genuine physical capture/permission evidence before Gold;
- **`password-strength-estimator`** and **`xml-formatter-validator`**: closed as Gold on bounded independent/NIST/W3C-backed contracts; reopen oracle review if their public claims expand;
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

- keep whole-tree browser-performance evidence current whenever source changes (the 2026-10-07 final refresh matches the integrated source fingerprint);
- keep rollback evidence bound to a real deploy → rollback → smoke → restore exercise; the 2026-10-07 `6480e9b` production cycle is verified;
- complete the legacy-domain transition by redirecting/retiring the independently served `strumentiutili.it` Vercel origin and capture proof that the split-brain is gone;
- add and verify outer Cloudflare WAF rate limiting on the active zone;
- configure the real Google Web Client ID and confirm Workers Paid before relying on password auth at production load;
- keep catalog-size claims separate from certification claims.

## P5 — continue the expansion backlog selectively

The expansion plan in `docs/10-tool-expansion-result-system-v2.md` has already been materialized into the 327-ticket DAG in `.scratch/strumentiutili-expansion-20261005/`. At the current checkpoint 235 tickets are completed and 92 remain blocked by explicit dependencies, source evidence, unsupported fidelity paths or physical-device requirements. Treat the validator's current frontier as the queue; do not restart the old seed wave.

- keep Result System v2 and functional-audit coverage complete as the catalog evolves;
- cover all 13 current CalcolaTutto jobs via add/upgrade/covered mappings;
- expand into high-value conversions, Italy utilities, Office/spreadsheet interchange, PDF/privacy workflows, developer/security, AI-era deterministic helpers, and capability-gated audio/video;
- treat annual fiscal rules as versioned sourced data and remote authoritative checks as explicit network operations;
- keep the no-vanity-count rule: a route exists for a real user job, not to inflate the catalog.

## Stop rules

Do not mark a tool Gold because it renders. Do not replace missing evidence with assumptions. Do not grow catalog size if regression rate, maintenance cost or evidence debt rises faster than user value. Do not standardize visually different product surfaces merely to reduce component count.
