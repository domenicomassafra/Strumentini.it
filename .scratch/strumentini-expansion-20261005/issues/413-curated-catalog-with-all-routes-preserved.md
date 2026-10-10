# 413 — Curated catalog with all routes preserved

**What to build:** Every manifest stays searchable while home selection reflects daily jobs

**Traces to:** OWN-01 OWN-02; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [x] AC-413.1: Every manifest stays searchable while home selection reflects daily jobs.
- [x] AC-413.2: No fabricated popularity or removing routes to gain clarity.
- [x] AC-413.3: On the scoped input and failure cases, verify: Catalog 269/269 route and editorial truth checks. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Catalog 269/269 route and editorial truth checks; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 verified implementation and closure

- `src/catalog/home-curation-413.ts` is the source-bound editorial eight-job list (PDF, images, CSV, text, QR, dates, business). `src/components/home/StarterTools.astro` explicitly labels the selection as editorial, not any inferred popularity ranking; unavailable/non-local/manipulated routes fail closed rather than substituting unsafe links.
- `tests/curated-catalog-413.test.ts`: 3/3 PASS: **269/269** current generated catalog IDs equal search and workbench projections; every one has an actual `src/pages/tools/<id>.astro` public route and canonical URL. Eight curated source IDs are unique, LOCAL/network-forbidden and span multiple categories; missing/duped/spoofed routes fail closed. Full `/strumenti/` still receives all catalog entries.
- `tests/acceptance-curated-catalog-413.mjs`: Chromium REAL localhost 390px PASS: eight editorial home cards, disclosure explicitly not a popularity list, directory 269, an unfeatured `csv-sort` route still responds 200, no horizontal overflow/page errors. No provider calls, hidden catalog mutation, Gold receipt changes or changes to output engines.
- Unsupported/huge/partial/cancel file-input behaviour belongs to #333/#335/#336/#407; this ticket is a catalog **routing and editorial selection** invariant, with no file bytes or long-running operations and therefore no false parser acceptance claimed.
