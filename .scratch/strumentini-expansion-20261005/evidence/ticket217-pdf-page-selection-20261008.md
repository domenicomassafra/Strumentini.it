# Ticket 217 — page selection, split ZIP, extract and delete (2026-10-08)

## Contracts

- Implemented shared local bounded parser `src/engines/pdf/page-selection.ts` and reused it in **both** the UI and real PDF operation modules, so visual page identities and text syntax cannot silently diverge.
- Accepted selection syntax: `tutte` / `*`, `1-3,5`, `ogni:N` selecting pages N,2N…, and for split `blocchi:N` generating consecutive groups of N pages. Multiple explicit split groups are `1-2; 3-5`. Invalid tokens, duplicates within groups, descending/out-of-range intervals, empty expressions and overly long input fail closed.
- Reused bounded ticket-215 thumbnail picker for split and extract/delete. Active-group editing preserves other groups, selected pages support keyboard/Space, inversion on extract/delete is deterministic, preview discloses part grouping and filename suffixes. Neither bitmap preview nor button controls alter the original PDF before the user submits.
- Split module independently reopens each output PDF and checks its page count; multi-output ZIP is **decompressed again**, and uncompressed entries are compared byte-for-byte with each produced PDF, beyond simply checking the central directory. Delete/extract output independently verifies the expected number of remaining or extracted pages. The existing PDF mutation engine retains authority; no fake OCR, no physical-device assertions.

## Reproducible commands

- `npm test`: includes `tests/pdf-page-selection.test.ts`, `tests/pdf-page-selection-operations.test.ts` (strict negative/positive, grouping, ZIP decompression and content), and existing `tests/pdf-document-tools.test.ts`.
- `npm run check` and `npm run build`: Astro/TypeScript, static catalog and build inspection.
- `npm run acceptance:pdf`: existing 20-route PDF regression including cancellation/error, browser keyboard and static local-only checks.
- `npm run acceptance:pdf-page-selection`: 390px Chromium/Firefox/WebKit user workflows, keyboard thumbnail group edits, downloaded ZIP reopen/extraction, independently reopened extracted/deleted PDF page texts, invalid token fail-closed, inversion, locality.
- `npm run deploy:check`: Cloudflare dry-run only, **not a live deployment**.
- Source-bound Gold, whole-tree browser and real rollback receipts are not manufactured; real iOS/Android image-resize evidence is still absent. The release gate must be independently passed before production promotion.
