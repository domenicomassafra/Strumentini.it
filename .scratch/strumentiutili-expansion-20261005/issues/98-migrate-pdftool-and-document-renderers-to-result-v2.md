# 98 — Migrate PdfTool and document renderers to Result v2

**What to build:** Migrate current PDF/document surfaces to PDF/file/validator semantics with page-aware facts, output bytes/pages, download and only truthful currently-supported preview capability.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-04.1, AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; preserve bounded in-house PDF engine limits.

**Blocked by:** 78, 81, 82.

**Status:** completed

**Suggested skills:** pdf → code-module-design → inclusive-design → code-tdd → qa-browser

- [x] All current PDF/document ids declare result semantics.
- [x] Page/text/file facts precede optional raw structure.
- [x] Thumbnail capability is not claimed before its dedicated renderer lands.

**Verification:** Current PDF Gold/acceptance plus malformed/encrypted/multi-page mobile fixtures.

**Completion evidence (2026-10-06):**

- `tests/pdf-result-v2.test.ts` binds exactly the 20 ledger-owned ids to their generated inventory declarations: 9 `pdf`, 2 `file`, 3 `text-code`, 6 `validator`. It also proves generated-PDF signature/container verification plus independent local parser reopen, blocks malformed generated artifacts, keeps long text previews bounded, keeps raw structure secondary, and observes no thumbnail/image claim in the PDF renderer.
- `src/components/tools/pdf/PdfResultV2.tsx` renders page/result/byte and inspection facts before `data-result-secondary-raw`; PDF output download is enabled only after artifact verification, and the page preview explicitly states that thumbnails are unavailable. `src/components/tools/pdf/PdfTool.tsx` now uses shared `ToolResultPanel`/Result v2 paths and preserves a distinct cancelled state.
- `npm run acceptance:pdf` PASS for all 20 routes. `quality/receipts/pdf/browser-acceptance.json` records keyboard/mobile/locality/lazy-load plus a 4,195,447-byte three-page PDF, malformed-PDF `error`, encrypted-PDF check, and a real merge cancellation with `outputProduced: false`.
- `npm run gold:pdf` PASS for all 20 PDF/document tools with exact vectors, re-inspected bytes and per-tool browser evidence.
- `npm run result-v2:conformance` PASS (9 semantic classes); `npm run acceptance:result-v2-conformance` PASS at 390 px with keyboard previews/actions.
- `npm run result-v2:legacy-audit -- --json` reports 0 findings, including 0 `manual-result-panel`; the previous `PdfTool.tsx` legacy primary path is gone.
- `npm run catalog:check`, `npx tsc --noEmit`, `npx astro build`, `npx tsx scripts/inspect-build.ts`, and `git diff --check` PASS. The umbrella `npm run build` reaches `certification:check` and is currently stopped by the shared-tree stale `quality/receipts/expanded-catalog-certification.json`; the direct Astro production build and build inspection pass.
