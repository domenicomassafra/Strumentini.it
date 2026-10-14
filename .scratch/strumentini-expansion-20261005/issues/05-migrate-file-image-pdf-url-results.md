# 05 — Migrate file/image/PDF/URL results

**What to build:** Migrate the 74 existing tools in `file-privacy` (19), `pdf` (20), `image` (15), `url-marketing` (12), `image-visual` (5), `qr-local` (2), and `file-hash` (1) to Result v2, including the shared file workspace, progress, preview, before/after metrics, direct downloads, batch status, and precise privacy claims.

**Traces to:** US-EXP-01, US-EXP-04, US-EXP-09; AC-01.1, AC-01.2, AC-04.1, AC-04.2; DEC-EXP-02, DEC-EXP-03; C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09

**Constraints:** No upload introduced for local tools; file drop/list/progress must be shared primitives; output bytes remain authoritative.

**Blocked by:** 96, 97, 98, 99.

**Status:** completed

- [x] 74/74 engine entries are covered by explicit file/image/PDF/URL result semantics.
- [x] File operations show name/type/size and before→after facts where applicable.
- [x] Batch failures are isolated and successful outputs remain downloadable.
- [x] Privacy/destructive results state what was actually removed/changed, not just "success".

**Verification:** Generated 74/74 coverage proof, existing Gold suites, byte-level assertions for destructive operations, and representative mobile file-flow browser acceptance.

**Evidence:** child tickets 96, 97, 98 and 99 are completed. Their generated ownership totals 19 file/privacy + 20 image + 20 PDF/document + 15 URL/QR/hash = 74/74 declared result semantics. File/privacy, image, PDF, URL/QR/hash focused suites and browser lanes pass with bounded previews, verified artifacts, byte/measured-change facts, isolated batch handling and local-only processing. Image-resize remains truthfully Partial/REFUSED for its still-open physical-device evidence rather than being promoted by this presentation migration.

## 2026-10-14 — File-hash cancellation regression, local UI and hostile Worker responses

**Source-bound RED:** On the isolated candidate browser acceptance `node scripts/acceptance-file-hash.mjs`, the real Chromium/Google Chrome workflow selects a 48 MiB local file, starts the real local hash Worker and clicks `Annulla`; the UI then never displays the expected `Calcolo dell'hash annullato.` alert (Playwright timeout 30 s). `FileHashTool.tsx` silently discarded a genuine rejected `AbortError` specifically when its own controller was aborted. The minimal fix displays that error for the still-current job while continuing to ignore superseded/reset controllers. No upload or routing change.

**Additional hostile packet variants:** The source-bound `tests/file-hash-engine.test.ts` used a deterministic event-queue WorkerPort fake to prove a stale queued progress callback continued after cancellation (**RED 1/11**) despite `terminate()`. Runtime handlers now detach and refuse callbacks from settled jobs. The separate adversarial packet corpus reproduced **RED 4/15** on unknown type disguised as success, non-hex success digest, forged byte count, and over-range progress; previously a forged result could be accepted as an authentic SHA-256. The Worker client now validates structured-clone packet type, progress bounds/fraction and SHA-256 result bytes/digest before resolving; invalid packets fail closed with `WORKER_FAILURE`, and controlled rejection terminates the Worker. Final scoped suite **15/15 GREEN**, strict TypeScript PASS and `git diff --check` PASS, no new library.

**Browser evidence:** The real local `scripts/acceptance-file-hash.mjs` exercises checksum correctness and lazy Worker request, local-only network/privacy, 48 MiB explicit cancellation, reset clearing the alert and a valid subsequent retry; successful browser receipt records measured `cancellationRetry`, `cancellationResetClearsError` and no external content requests. The source build and receipt/index regeneration must be rerun on the exact finalized source SHA before review or acceptance; historical receipts do not prove the future commit. The original file/image/PDF/URL result migration remains `completed` for its actual original scope; this is a repaired regression, **not** a Gold/device/release acceptance, nor proof of physical iOS/Android, provider authentication or rollback.
