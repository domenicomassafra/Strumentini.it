# 06 — CSV parser gate and CSV Cleaner Gold vertical

**What to build:** Choose a production CSV parser through the documented dependency/adversarial gate, then make CSV Cleaner a real local-file Gold tool through the same catalog/runtime UI stack. This is the first table/file tracer and must prove that bounded cleanup is safe, observable, cancelable when perceptible, and independently validated.

**Traces to:** US-10 / AC-10.1 / AC-10.4 / US-11 / AC-11.1 / AC-11.2 / US-14 / AC-14.3 / DEC-12 / DEC-13 / DEC-18 / T08

**Constraints:** C-03 / C-04 / C-05 / C-06 / C-09 / C-11 / C-12 / C-13 / C-15 / C-20 / C-21

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** complete

- [x] Start from the completed donor census and compare at least Papa Parse and `csv-parse`; also inspect completed oracle output if present. Pin a winner only after the Strumentini.it corpus/worker/bundle/license/security evidence.
- [x] The selected parser has a pinned version, recorded license/source, acceptable maintenance/security posture, measured lazy bundle cost, and no unexplained transitive/runtime burden.
- [x] The adversarial corpus covers quoted delimiters/newlines, escaped quotes, BOM, CRLF/LF, empty trailing cells, ragged rows, duplicate/odd headers, malformed quotes, UTF-8/Unicode, large streaming input, and cancellation.
- [x] CSV Cleaner accepts ordinary file input, shows a preview/change summary, never uploads the file, and produces output validated by independent fixtures/semantic reparse.
- [x] Hard/soft size limits and parser/capability failures are preflighted or normalized without unsafe allocation/fake success.
- [x] Perceptible work has truthful stable processing/progress behavior and cancellation where the chosen parser/runtime can support it.
- [x] CSV Cleaner reaches Gold with mobile file-picker acceptance and no dependency code in unrelated shell/tool routes.

**Verification:** Run the adversarial parser corpus, dependency/license/security and bundle checks, CSV Cleaner known-output/semantic-reparse tests, large-input cancellation/failure tests, LOCAL browser-network assertion, mobile file flow, and Gold certification.

## Completion receipt — 2026-09-23

- Papa Parse 5.7.0 selected over csv-parse 7.0.2 after exact corpus + malformed quote + browser bundle comparison (19,566 B vs 52,063 B minified comparison bundle); both MIT and zero direct runtime dependencies.
- `npx vitest run tests/csv-cleaner-engine.test.ts` — 5/5 PASS.
- The one-time parser gate was run before integration; its losing evaluation dependency was removed afterward.
- `npx tsx scripts/gold/csv-cleaner-certify.ts` — 6 exact vectors PASS.
- `node scripts/acceptance-csv-cleaner.mjs` — 390 px local file picker/preview/BOM/locality PASS.
- `npx tsx scripts/gold/csv-bundle.ts` — Papa production chunk absent from unrelated Business Day route.
- `npm run build` — PASS with `/tools/csv-cleaner/` static route.
- Root `npm audit` at parser selection — 0 vulnerabilities.
- `git diff --check` — PASS.
