# 370 — Spreadsheet CSV Excel donor fidelity

**What to build:** Benchmark installed/donor per sheets, formulas, data types

**Traces to:** OWN-04 OWN-15; OWN authority 2026-10-10

**Constraints:** Preserve local-first, anonymous-first, proprietary license, WCAG 2.2 AA, mobile advanced access, zero additional initial costs, no false Gold or silent cloud upload

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → security-audit → code-tdd → qa-browser; domain skills as needed

**Level:** feasibility

**Priority:** P1 feasibility or advanced user capability

**Current evidence:** Historical audit as of 2026-10-10; not a shipped new feature

**Donor / reuse decision:** Compare installed, native local, maintained licensed donor and commercial alternative. Pin version/license/transitive assets; no automatic fork

## Acceptance criteria

- [ ] AC-370.1: Benchmark installed/donor per sheets, formulas, data types.
- [x] AC-370.2: Macro/external links/style unsupported non sono promesse. Disclosure matrix recorded in `docs/donor-spreadsheets-370-2026-10-11.md`; this is not a claim of input sanitization.
- [ ] AC-370.3: On the scoped input and failure cases, verify: XLSX roundtrip oracle and perf. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** XLSX roundtrip oracle and perf. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## 2026-10-11 worker-8 feasibility addendum — source-bound evidence

- **Baseline:** `42562bb4` clean `main`. No app source, `package.json`, lockfile, other issue or shared worker/image file changed by this worker. No commit/push/deploy. New local test: `tests/donor-spreadsheets-370.test.ts`; independent report: `docs/donor-spreadsheets-370-2026-10-11.md`. No new runtime dependency.
- **Installed engines:** `papaparse@5.7.0` (MIT), `read-excel-file@9.3.10` (MIT), `write-excel-file@4.1.1` (MIT). Current public writer emits one sheet with text by default; importer requires explicit selection for multi-sheet; numbers/dates can be selected by column policy. Literal `00123` stays text; output `=1+1` from CSV stays inert text, not executable formula.
- **Independent readback:** isolated Python `openpyxl==3.1.5`, `et_xmlfile==2.0.0` (oracle only; outside repo), `SPREADSHEET370_PYTHON=/tmp/strumentini-370-openpyxl/bin/python ./node_modules/.bin/vitest run tests/donor-spreadsheets-370.test.ts tests/spreadsheet-interchange.test.ts` → **15/15 PASS**. Python verifies independent cell types `s/n/d/s`, dates, leading zeros, source formula/hyperlink fixture, synthetic macro marker behavior and 12,006-cell readback. Performance on this Mac: three runs of app write→read→CSV 12,006 cells, p50 **166 ms**, max **172 ms**; independent openpyxl readback **220 ms**. Browser/mobile, larger/worst-case archives and reliable percentile guarantees NOT_RUN.
- **Explicit NO_GO:** source XLSX formulas are neither preserved nor evaluated; uncached formula yields blank, forged stale result of `=1+1` read as `777`. Synthetic macro-enabled OOXML with `xl/vbaProject.bin` marker **was accepted** by current `xlsxToCsv` (not an executable VBA payload, but enough to refute a general macro-refusal guarantee). Linked URL metadata and styles are not preserved as workbook features; hostile link policy and ZIP-bomb preflight are **NOT_SUPPORTED / NOT_VERIFIED** on this public seam. Do **not** advertise input macro sanitization, correct computed results, style fidelity or general XLSX roundtrip.
- **Donor decision:** `exceljs@4.4.0` MIT and SheetJS CE `0.20.3` Apache-2.0 are **NOT INSTALLED / NO_ADOPT** without pinned donor runtime benchmarking, security/rights and mobile evaluation; SheetJS Pro/commercial remains **NO_ADOPT** pending owner license and cost. Python openpyxl is oracle only.

**Disposition:** AC-370.2 reflects the explicit scoped documentation disclosure above. **AC-370.1 and AC-370.3 remain unchecked**, since real donor runtime comparison, robust macro/external/ZIP refusal and mobile/physical proof are incomplete. Full ticket cannot close; no claimed Gold/release certification.

## 2026-10-12 worker-22 operational refusal addendum — isolated follow-up

- **New preflight, superseding one earlier negative probe:** `src/engines/table/spreadsheet-interchange.ts` now calls the existing bounded central-directory `analyzeOoxmlPackage` before `read-excel-file/universal` on the public `xlsxToCsv` path. Actual `xl/vbaProject.bin` (including casing variants), ZIP traversal, encrypted or unsupported directory shapes and declared excessive ZIP expansion are refused before the generic workbook reader. The 10 MiB compressed input quota remains in effect; the reused preflight caps expanded members/counts and rejects invalid ZIP metadata. A second narrow `[Content_Types].xml` read uses bounded expansion, declared byte count and CRC32 verification; macro/ActiveX content-type declarations are refused even when the VBA member is missing. New `UNSUPPORTED_XLSX_FEATURE` identifies macro refusal; ZIP corruption continues as `XLSX_READ_FAILED` and excessive declared expansion as `FILE_TOO_LARGE`.
- **Independent binary RED→GREEN:** New `tests/xlsx-macro-refusal-370-next.test.ts` starts with actual `csvToXlsx` output; Python's standard-library `zipfile` independently injects/validates the real OOXML member, content type, unsafe path and 8 MiB highly compressed synthetic XML. Pinned `openpyxl==3.1.5` independently reopens the marked package with `keep_vba=True`, confirming the fixture still contains valid spreadsheet values; the VBA marker is explicitly synthetic/non-executable. Before the patch **6/7 failed** because the reader accepted the hostile ZIPs; after the patch **7/7 passed**. Adjacent `tests/spreadsheet-interchange.test.ts` **5/5**, `tests/xml-interchange.test.ts` **6/6**, `tests/pdf-table-xlsx-254.test.ts` **2/2** passed. Real official ISTAT XLSX imports with preserved leading-zero codes. Historical donor suite without opt-in oracle **5 PASS / 5 SKIP**, benchmark 12,006 cells p50 138 ms, max 150 ms (3 samples, not an SLA).
- **Historical test needs re-baselining by its owner:** `tests/donor-spreadsheets-370.test.ts` includes an opt-in test at line 202 explicitly asserting that the *old* reader accepted the macro marker. Running it with `SPREADSHEET370_PYTHON=/tmp/strumentini-370-openpyxl/bin/python` now produces **9 PASS / 1 expected stale failure**, caused by the new `UNSUPPORTED_XLSX_FEATURE` refusal. That older receipt was kept unchanged due to exclusive worker file ownership; update the legacy expectation separately during prime integration. Its dated negative observation remains historically accurate for the original build.
- **Remaining NO_GO and limits:** This is a bounded central-directory/manifest refusal, not a complete hostile XLSX sandbox. Relationship content, all XML, hidden formula cache manipulation, externally linked workbook features and false ZIP size metadata have **not** been comprehensively validated; formulas can still yield stale cached values, styles and formulas are not preserved. Real installed-vs-donor runtime comparison, mobile browser/performance evidence and official external approvals are pending. **AC-370.1 and AC-370.3 stay open; ticket remains NO_GO.** No new dependencies, production/provider activity, deployment, Gold evidence, commit or push from this worker.
