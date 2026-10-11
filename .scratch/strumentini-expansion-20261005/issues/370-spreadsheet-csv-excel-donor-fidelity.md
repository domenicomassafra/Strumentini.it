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
