# 248 — Search text across multiple PDFs

**What to build:** Add local multi-PDF text search returning file/page/context, isolating unreadable/encrypted/scanned failures and offering OCR handoff for non-searchable files.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 79, 220.

**Status:** completed

**Suggested skills:** pdf → code-module-design → code-tdd → inclusive-design

- [x] Results preserve file/page/context provenance.
- [x] One unreadable PDF does not abort other files.
- [x] Scanned/no-text files are distinguished from no-match.

**Verification:** tests/pdf-search-markdown-upgrades.test.ts covers a mixed batch with searchable, no-match, no-text, encrypted and malformed PDFs; exact file/page/match/context provenance; query/context/result bounds; and module-level filename preservation. scripts/acceptance-pdf-search-markdown.mjs passed at 390px using production pdf-multi-text-search + PdfResultV2 with zero external/non-GET/task-body requests and no horizontal overflow. quality/oracles/validate.py passes with cand-253.

**Evidence (2026-10-06):** Added the distinct /tools/pdf-multi-text-search job on the existing PDF engine/result workspace. The engine classifies each file independently as matches/no-match/no-text/encrypted/unreadable, continues after failures, bounds query/context/returned hits, and records fileIndex+filename+page+matchIndex for each result. No-text files expose an explicit OCR handoff with available=false and backlog ticket 247; no OCR route/result is fabricated.
