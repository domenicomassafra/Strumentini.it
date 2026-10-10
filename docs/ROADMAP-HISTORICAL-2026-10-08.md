# Historical roadmap snapshot — 2026-10-08

This is archived unchanged from ROADMAP.md before the 2026-10-10 owner-aligned planning update; not current scheduling authority.

# ROADMAP

Current stage: **257/259 Gold + final physical/infrastructure closure**.

Checkpoint 2026-10-08: 259 tools exist; **257 are Gold** and only `image-resize` plus `microphone-recorder` remain **Partial** for genuine physical-device evidence. `password-strength-estimator` and `xml-formatter-validator` retain bounded high-confidence oracle evidence and Gold receipts tied to their certified source. The integrated suite is green at **1,134 tests / 146 files**, `astro check` at **0 errors / 0 warnings** (16 deprecated matcher hints), and the static build emits **279 pages**. Tickets **48, 52, 210, 211, 215, 216, 217, 221, 319** are implemented; ticket 59 has a partial native-format milestone and remains open. Ticket 52 added cross-file page interleaving, removal, rotation and source-aware undo; ticket 221 adds bounded aligned/structural/text PDF evidence and an optional rendered red-pixel overlay; ticket 319 adds source-aware PDF form/widget/page inventory and fail-closed safe-subset flatten with exact before/after verification and real rendered visual parity. Chromium/Firefox/WebKit acceptance passes **54/54** for visual PDF organization, **24/24** for comparison and **21/21** for safe flatten. The 327-ticket DAG is **245 completed / 82 open**, 28 at the declared dependency frontier.

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

- keep whole-tree browser-performance evidence current whenever source changes (the 2026-10-07 refresh matched the *earlier deployed release* and is now stale against newer main; fresh evidence is required before the next deploy);
- keep rollback evidence bound to a real deploy → rollback → smoke → restore exercise; the 2026-10-08 `2af6e8c` / `2c38b13c…` production cycle is verified, including the `strumentini-auth` D1 cutover;
- add and verify outer Cloudflare WAF rate limiting on the active zone;
- configure the real Google Web Client ID and confirm Workers Paid before relying on password auth at production load;
- keep catalog-size claims separate from certification claims.

## P5 — continue the expansion backlog selectively

The expansion plan in `docs/10-tool-expansion-result-system-v2.md` has already been materialized into the 327-ticket DAG in `.scratch/strumentini-expansion-20261005/`. At the current checkpoint **246 tickets are completed (18 explicit refusals), 81 open**: 20 ready-for-agent candidates, 53 dependency-blocked, 2 official-source-blocked, 5 physical-device-blocked and 1 capability-blocked. Of the 28 numerically dependency-ready tickets, eight are still gated by non-DAG evidence. The generated `CURRENT-TICKET-DASHBOARD.md` is the execution queue and must pass `npm run tickets:check`; numeric readiness does not mean an engine is approved or a release is ready. Prioritize #232 then #234/#305/#266, #218 then #219/#249/#265, #236 then #255, plus official source #117 only when independently complete and pinned. Ticket #320 closed as an explicit refusal because #242 does not provide an approved PDF decrypt engine; #053 continues capability-blocked, and neither ticket claims functional password-supplied decryption. Do not restart the old seed wave.

- keep Result System v2 and functional-audit coverage complete as the catalog evolves;
- cover all 13 current CalcolaTutto jobs via add/upgrade/covered mappings;
- expand into high-value conversions, Italy utilities, Office/spreadsheet interchange, PDF/privacy workflows, developer/security, AI-era deterministic helpers, and capability-gated audio/video;
- treat annual fiscal rules as versioned sourced data and remote authoritative checks as explicit network operations;
- keep the no-vanity-count rule: a route exists for a real user job, not to inflate the catalog.

## Stop rules

Do not mark a tool Gold because it renders. Do not replace missing evidence with assumptions. Do not grow catalog size if regression rate, maintenance cost or evidence debt rises faster than user value. Do not standardize visually different product surfaces merely to reduce component count.
