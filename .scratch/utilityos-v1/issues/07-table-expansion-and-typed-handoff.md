# 07 — CSV Dedupe, Column Map, and typed handoff

**What to build:** Deepen the proven table module with CSV Dedupe and CSV Column Map/Reorder, then implement the first required typed handoff from CSV Cleaner to CSV Dedupe with an explicit payload preview. Preserve independent focused routes while reusing one parsed table representation and engine.

**Traces to:** US-08 / AC-08.1 / AC-08.2 / AC-08.3 / AC-08.4 / US-10 / AC-10.1 / US-11 / AC-11.1 / AC-11.4 / T09 / T10

**Constraints:** C-04 / C-05 / C-06 / C-09 / C-10 / C-11 / C-12 / C-13 / C-20 / C-21

**Blocked by:** 02 — Local Workbench, Work Profile, and portable configuration; 06 — CSV parser gate and CSV Cleaner Gold vertical.

**Status:** complete

- [x] CSV Dedupe supports explicit whole-row/key-column rules, stable deterministic output, idempotence where applicable, and duplicate-header/empty-key edge fixtures.
- [x] CSV Column Map/Reorder previews output schema/order, preserves row data under declared rules, and handles missing/duplicate column names explicitly.
- [x] Table tools reuse one deep parsed-table engine; manifests remain independently searchable/openable and do not import each other.
- [x] Handoff compatibility is derived from emitted/accepted table descriptors, never direct imports.
- [x] CSV Cleaner completion can propose CSV Dedupe; the proposal shows row count/payload description and transfers only after explicit user action.
- [x] Incompatible/lossy descriptors are rejected or disclosed before transfer and no task history is implicitly persisted by handoff.
- [x] Both new tools and the required Cleaner→Dedupe flow pass Gold/browser/mobile/keyboard acceptance.

**Verification:** Run table dedupe/schema fixtures and properties, a module-dependency check proving no direct tool imports, browser acceptance for Cleaner→Dedupe payload preview/confirm/cancel, incompatible handoff tests, and Gold certification for T09/T10.

## Completion receipt — 2026-09-23

- `npm test` — 94/94 PASS at closure.
- `npm run check` — 0 errors / 0 warnings / 0 hints.
- `npm run build` — PASS; 15 tools / 17 static pages.
- `npx vitest run tests/table-ops-handoff.test.ts tests/catalog.test.ts` — typed descriptor, dedupe, column-map, incompatible-size/header rules PASS.
- `npx tsx scripts/gold/table-ops-certify.ts` — CSV Dedupe 3 exact vectors; CSV Column Map/Reorder 3 exact vectors; both Gold PASS.
- `npx tsx scripts/gold/table-handoff-architecture.ts` — no direct cross-tool imports; Cleaner/Dedupe/Column Map share one lazy CSV/table engine chunk; descriptor compatibility PASS.
- `node scripts/acceptance-table-handoff.mjs` — Cleaner→Dedupe preview, dismiss, explicit same-origin in-memory transfer, payload absent from URL/localStorage/sessionStorage/IndexedDB, stable Dedupe result, Column Map reorder/rename, keyboard and 390 px mobile PASS.
- Handoff transport uses a random one-shot token plus same-origin `postMessage`; target revalidates envelope shape, UTF-8 byte count and its own accepted descriptor before applying it.
- Global fixture-index identity was advanced for `csv-table-ops`; all Gold receipts carrying the previous fixture-index fingerprint were regenerated. Image Resize remains truthful `PARTIAL` pending physical iOS Safari + Android Chrome acceptance.
- `npm run verify:ticket-01` — PASS including Gold sabotage/browser acceptance/Cloudflare Workers Static Assets dry-run.
- `npm audit --audit-level=high` — 0 vulnerabilities.
- `git diff --check` — PASS.
