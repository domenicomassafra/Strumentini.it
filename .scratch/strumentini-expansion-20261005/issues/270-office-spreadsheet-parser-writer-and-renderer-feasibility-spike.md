# 270 — Office spreadsheet parser writer and renderer feasibility spike

**What to build:** Choose or refuse local XLSX/DOCX/PPTX parse/write/render dependencies with exact version/license, lazy bundle, format-feature matrix, mobile memory and fidelity corpus requirements.

**Traces to:** US-EXP-04, US-EXP-06; AC-06.1

**Constraints:** C-EXP-02, C-EXP-05, C-EXP-08; no cloud fallback.

**Blocked by:** None — ticket 100 is completed.

**Status:** completed

**Suggested skills:** security-audit → browser-performance-benchmark → qa-browser

- [x] Parse/write and faithful render are separate decisions.
- [x] CSV↔XLSX may be accepted even if Office→PDF rendering is refused.
- [x] Macros/external links/active content have explicit security policy.

**Verification:** Office corpus benchmark and IMPLEMENT/SPIKE/REFUSE matrix.

**Evidence (2026-10-07 refresh):** the original denial of `xlsx@0.18.5` and `pptxgenjs@4.0.1` remains unchanged, and faithful Office→PDF rendering remains **REFUSE**. The parse/write subdecision is now **IMPLEMENT_BOUNDED** using newly evaluated `read-excel-file@9.3.10` + `write-excel-file@4.1.1` + `fflate@0.8.3`: direct/transitive licenses on this path are MIT, production `npm audit --omit=dev --audit-level=high` is clean, the standalone lazy browser payload is 12.52 KB gzip client + 54.50 KB gzip worker, and browser acceptance proves an explicit-action-only load, worker isolation, zero external requests and a 390px run. The official ISTAT workbook and generated typed/string workbook corpus pass. This refresh authorizes only the bounded XLSX parse/write seam used by ticket 161; it does not authorize faithful Office rendering, macros/active content, remote-linked resource resolution or any claim of physical-device evidence. Consolidated evidence: `quality/benchmarks/heavy-local-feasibility/office-ooxml-refresh-2026-10-07.json`.
