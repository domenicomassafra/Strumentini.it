# 404 — Change scoped CI and cumulative release validation

**What to build:** Affected engine and integration tests run each batch, cumulated release gates before publish

**Traces to:** OWN-03; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-404.1: Affected engine and integration tests run each batch, cumulated release gates before publish.
- [ ] AC-404.2: Safety/physical checks cannot be waived by labels.
- [ ] AC-404.3: On the scoped input and failure cases, verify: Synthetic UI/Worker/engine diff pipeline mapping. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Synthetic UI/Worker/engine diff pipeline mapping; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 01 — bounded evidence

Git-aware source change-impact and non-deployment GitHub CI workflow created; eight focused tests PASS; GitHub remote workflow and mandatory physical/security/official-source release gates NOT_RUN.

**Disposition:** Scope implemented and locally verified as stated; this dated note does not check unproven original AC, close the ticket, certify Gold or authorize release. See `docs/IMPLEMENTATION-WAVE-01-2026-10-11.md` for code/test paths and residual gates.

## 2026-10-11 follow-up — fail-closed scope mapping, still OPEN

Independent audit identified two holes in the source-change classifier: executable Python/JS ticket validators beneath `.scratch/` were treated as docs-only, while the actual `image-visual/`, `image-resize/` and top-level `Pdf*` tool components were not all mapped to the image/PDF device gates. Regression tests reproduced both false classifications **before** the fix. The path classifier now treats executable ticket generators as CI code (full source regression), and real image/PDF component families as frontend + their engine domain, preserving affected test selection and physical-device `NOT_RUN` gates. `tests/ci-change-impact-404.test.ts`: **10/10 PASS** on the local checkout.

The GitHub branch `main` was read independently via authenticated API and matched local `origin/main` at `d0947cc` before this change. However the updated CI workflow has **not run remotely** and no release candidate or real browser/physical/security gate was approved. `AC-404.1` remains open for cumulative release validation before publication; the scoped test demonstrates correct mapping rather than production readiness. Do not close the ticket, issue a Gold receipt, push or deploy based on this follow-up alone.

**Independent security review follow-up:** the first patch still omitted the actual `src/runtime/ephemeral-file-handoff-337.ts` from the mandatory security-review gate. A test reproduced this omission (RED), then the classifier added this specific cross-window capability protocol to security-sensitive runtime inputs: focused CI tests **11/11 PASS**. This flags the required external security review as `NOT_RUN`; it does not perform that review or declare a release ready.

**2026-10-11 wave 09 security-gate regression:** code review after the #407 hostile ZIP pathname fix found that `src/runtime/file-threat-gate-407.ts` was still classified as generic shared source instead of independently security-reviewed file-parser boundary. Added a RED→GREEN regression and included that exact runtime module in the existing `security-review` gate rule. `vitest run tests/ci-change-impact-404.test.ts --maxWorkers=1`: **12/12 PASS**, unchanged release-readiness fail-closed behavior and review status `NOT_RUN`. The classifier now requests a security review; it does **not** attest that one occurred or close #404.

## 2026-10-11 wave 11 — sensitive local storage, download and sanitization paths (ticket OPEN)

**Reproduced RED:** A sole source edit to `src/workbench/saved-pdf-341.ts` was classified as generic `shared` with only `release-readiness: NOT_RUN`, omitting any independent security review or physical-device gate. The same missing security gate affected local download/opt-in policy and image metadata stripping, where sensitive bytes may be persisted, exported or falsely described as clean. Added a synthetic changed-path test first; it failed before the source patch on `security-review` missing.

**Minimal fix + GREEN:** `scripts/ci-change-impact-404.ts` now adds `security-review: NOT_RUN` for local PDF IndexedDB storage, manual/automatic browser download policy, image metadata scanners/stripper, EXIF tool and file-privacy engine, plus `physical-device: NOT_RUN` for persisted PDF and download browser boundaries. Existing `release-readiness` and `browser-a11y` gates are preserved; no review is marked `PASS` by this path classifier. `tests/ci-change-impact-404.test.ts` exercises seven exact sensitive paths with expected `NOT_RUN` gates. `vitest run tests/ci-change-impact-404.test.ts --maxWorkers=1`: **13/13 PASS** after the fix; `git diff --check` PASS. No CI assertion removed or skipped, no workflow or receipt mutation.

**Remaining:** AC-404.1–3 stay unchecked globally. This test establishes scope selection, **not** independent security attestation, physical iOS/Android measurements, current browser receipts, real rollback or Gold release readiness. No deploy authorization and no false completion.

## 2026-10-11 wave 13 — real byte-processing and consent UI mapped to security review

Fresh source review after the bounded #340/#410 and image opt-in #339 integrations found new sensitive paths missing from the independent security-review gate: `src/runtime/batch-file-410.ts` (untrusted file bytes and GZIP), `src/workbench/session-history-340.ts` (private in-memory byte snapshots), and the actual `ImageVisualTool.tsx` / `PdfTool.tsx` consent-aware UI producers. A new synthetic changed-path regression was **RED before the patch**, showing `release-readiness: NOT_RUN` but no `security-review`; after precisely scoped mapping changes, focused `tests/ci-change-impact-404.test.ts` is **14/14 PASS**. `security-review` is now **required as NOT_RUN**, not certified or waived. No runtime/file transfer code, Gold receipts or release validator was modified; AC-404.1–3 remain OPEN pending independent review and cumulative publication acceptance.

## 2026-10-11 wave 14 — review required for the user-facing local byte panels

Review of the newly published SessionChain340 and BatchGzipLab410 UI found another narrow gap: editing `src/components/workbench/SessionChain340.tsx` or `src/components/lab/BatchGzipLab410.astro` selected browser/accessibility and release gates, but **not** independent security review, despite interacting with private bytes and downloadable files. A new exact-path test first failed RED with `security-review` missing; the fix lists both existing components in the same conservative byte-processing classifier, without broadening source authority or changing any runtime. Focused `tests/ci-change-impact-404.test.ts` now **15/15 PASS**; both `browser-a11y` and `security-review` remain `NOT_RUN` until independently proven. Original #404 status stays OPEN; this is regression prevention, not release certification.

## 2026-10-11 wave 15 — shipped OCR runtime assets must not bypass source gates

Inspected the tracked `public/ocr-246/` files and their actual browser consumer `src/engines/ocr/local-italian-246.ts`: shipped Tesseract JavaScript, worker, WASM core and local Italian `.traineddata.gz` are loaded and parsed during user-facing OCR operations, but the previous change classifier treated these paths as ordinary `frontend` static assets without OCR/PDF affected tests, security review or the physical-device gate. Added an exact-path adversarial test for four representative tracked assets. **RED:** `tests/ci-change-impact-404.test.ts` 15 PASS / 1 FAIL, returning only `["frontend"]` for `public/ocr-246/vendor/tesseract.esm.min.js`. A narrow source-path mapping for shipped OCR executable/model payloads now selects `frontend` + `pdf` tests and marks `security-review`, `physical-device`, `browser-a11y`, and `release-readiness` **NOT_RUN**. LICENSE and other benign public resources are not falsely classified as OCR code. **GREEN:** focused Vitest **16/16 PASS**, `git diff --check` PASS. One prior test rerun was CPU-contended under parallel worker activity (Git fixture exceeded default 5-second timeout); only that fixture's timeout was raised to 20 seconds, assertions unchanged, and the subsequent full 16/16 run finished in 3.38 seconds. A second adversarial RED fixture found that the true `src/engines/ocr/local-italian-246.ts` engine did select PDF device tests but lacked independent security review, while `src/components/tools/ocr246/LocalItalianOcr246Tool.tsx` was classified merely as frontend. Both source boundaries now select the OCR/PDF suite and security review. Final full focused suite **17/17 PASS** (5.99 seconds). No vendored byte, security review receipt, Gold certification, or deployment changed. Original AC-404.1–3 remain OPEN until cumulative acceptance and independent gate evidence.

## 2026-10-11 wave 16 — irreversible PDF redaction source gate

A new #406 independent adversarial PDF revision test demonstrated that changes to `src/engines/pdf/secure-raster-redaction-237.ts` can affect actual irreversible erasure. `buildImpactPlan` initially classified this exact high-risk engine as PDF with physical-device and release gates but **without independent security review**. A focused synthetic source-path test reproduced the missing `security-review: NOT_RUN` gate **RED** before the correction. The exact engine is now explicitly treated as requiring security review without waiving any previous test, status or gate. This selects an independent review; it does **not** assert review completion, certify redaction security or authorize publication. Original AC-404.1–3 remain OPEN.

## 2026-10-11 wave 17 — exact Italian tax-source audit and customer journey paths

The new read-only official source ledger `scripts/validator/audit-397.ts`, its adversarial tests `tests/audit-397.test.ts` and the compiled-static anonymous fiscal acceptance `tests/tax-journeys-396.browser.mjs` do not all follow the generic `italy-` filename prefix. Before this adjustment the exact source auditor classified as generic `shared`, omitting the separate `official-source-year: NOT_RUN` review despite relying on official tax-year validity. A new three-path adversarial test reproduced the missing Italy domain **RED**. The named bounded source auditor, its tests, and real browser journey acceptance now select Italy suites and the non-waivable official-source-year gate (the browser acceptance additionally selects frontend/a11y). **GREEN:** focused suite `tests/ci-change-impact-404.test.ts` **19/19 PASS**. It demands review; it neither asserts any fiscal source completeness nor accepts the #397 ledger gaps. Original #404 remains OPEN, and no release status was changed.

## 2026-10-11 wave 18 — independent redaction forensics and Gold provenance admission

The separate `scripts/forensic-redaction-378.ts` and its TDD test had incorrectly classified as generic shared scripts rather than PDF evidence processing; this failed to demand independent security and physical-device review. Likewise, `scripts/audit-per-tool-proof-415.ts` and the new receipt-path adversarial test lacked a source-path security audit gate when changed, despite mediating proof attribution. A synthetic 4-path test reproduced the PDF-domain omission **RED** and the missing source security gate. Exact, conservative mappings now select `pdf` + `security-review` + `physical-device` for forensic source and tests, and CI/security review for the Gold per-tool attribution source and test. No Gold authority or review result has been issued. **GREEN:** focused change planner **20/20 PASS**. Original #404 still OPEN because release matrix and cumulative independent gates remain unproven.

## 2026-10-12 independent XLSX source/worker gate — bounded #404 evidence

`src/engines/table/spreadsheet-interchange.ts` parses untrusted XLSX/OOXML as part of an available local Office worker (`src/engines/office-local/worker.ts`, exported by `client.ts` and `worker-protocol.ts`), with a known macro-content-type refusal gap separately documented in original #370. Previously the affected change paths (including direct and donor tests) were generic `shared` and scheduled the broad npm suite, but did not explicitly select workbook-specific tests or the independent security/device gates. The present source search found the worker import/export entry; it did not find a current direct UI call to `runOfficeLocalJob`, so physical browser acceptance is **NOT_RUN**.

Added `tests/ci-change-impact-404-spreadsheet-next.test.ts` before the source fix: **RED 3 failures / 1 pass**, proving missing spreadsheet scope and mandatory test blockers. The classifier now returns `shared` **plus** `spreadsheet` for the exact parser, Office worker/client/protocol and two core XLSX tests, preserving existing full `npm run test` coverage. It explicitly selects `tests/spreadsheet-interchange.test.ts`, `tests/donor-spreadsheets-370.test.ts`, and present adjacent XML/PDF-XLSX/OOXML suites. If either of the two mandatory suites is unavailable, planning returns `NO_GO` with a named missing-suite blocker and no commands. `security-review`, `physical-device` and `release-readiness` are all **NOT_RUN**, never accepted automatically.

**GREEN / independent outcome:** new tests **4/4 PASS**, existing #404 planner **20/20 PASS** (total **24/24**); affected real workbook suites **26 PASS / 5 skipped** because optional Python oracle fixtures were unavailable; `npm run check` **PASS** (Astro 0 errors, 0 warnings, 23 existing deprecation hints); `git diff --check` **PASS**. No provider, physical device, source engine, CI workflow, Gold receipt, release validator, commit or deploy changed. Original AC-404.1–3 remain **OPEN** until current cumulative release proof and independent security/physical evidence are available. This test is a path-level CI enforcement proof, not acceptance of macro-handling safety.


## 2026-10-13 native CoS follow-up — provenance data and Python ticket test CI

**Two independent false-scope cases, both RED before fix:** `docs/audit-2026-10-10/donor-packages.json` is a machine-readable source input to `scripts/donor-provenance-366.ts`, but the classifier called it `DOCS_ONLY`, running zero tests; changing `.scratch/strumentini-expansion-20261005/ticket_dashboard.py` or its Python unittest selected `npm test`/check/build but omitted the actual `npm run tickets:test` Python oracle. `tests/test_ticket_dashboard.py` also passed only as generic `shared` without that Python unittest. These are defects in source-check coverage, not new authorization for release.

**Scoped correction:** classify exactly the donor provenance JSON as CI, exactly the dashboard unittest as CI, and append `npm run tickets:test` for changes to the Python generator, backlog validator, or the Python test. Retain docs-only status for ordinary docs and NO_GO for unknown paths. Preserve earlier PR #11 fixes: root HANDOFF.md/PROJECT-STATUS.md docs classification and `npm run catalog:build` before targeted Vitest on clean GitHub CI. **New tests** `tests/ci-change-impact-404-wave4-20261013.test.ts` reproduced two RED cases, then **29/29 GREEN** with prior #404 suites; no new libraries, test skip, label bypass or deploy gate suppression. Earlier exact PR #6 isolated copy`s 5 Python unittests passed on its own source, in contrast to historical main tests failing with fixed obsolete counts; this new CI check will make that Python receipt mandatory when PR #6 is rebased on reviewed #404 updates.

**Acceptance:** The broad AC-404.1–3 remain OPEN; this is source-scope validation only. GitHub PR, full merge/preview, physical browser, security and final release gates still need independent proof. No Gold status promotion, download, cloud account access or source-of-truth change made by this tranche.

## 2026-10-13 worker-1 — cumulative Python oracle and explicit read-only release admission

**Actual missing CI proof (RED):** `cumulative-on-main` previously ran `npm test -- --maxWorkers=1`, `npm run check` and `npm run build` but omitted the five Python `tests/test_ticket_dashboard.py` unit tests (`npm run tickets:test`); the Git change classifier correctly selected these tests on related PRs, but the cumulative main path did not. The repository also had a fail-closed, read-only `scripts/validate-release.ts --no-write-receipt --require-ready` implementation but no manually runnable GitHub Actions release-admission trigger. New `tests/ci-404-20261013-release-admission.test.ts` was **RED** with exactly four absent workflow requirements: release trigger, dispatch-to-cumulative binding, Python unit test command and read-only `--require-ready` validation.

**GREEN / reuse existing native workflow and validator:** In the existing `.github/workflows/ci.yml`, `cumulative-on-main` now runs `npm run tickets:test` for every main push. An explicit `workflow_dispatch` runs the *same cumulative main source suite* followed by `node node_modules/tsx/dist/cli.mjs scripts/validate-release.ts --no-write-receipt --require-ready`; this last step runs only for manual dispatch, does not deploy and cannot write/rebase receipts. GitHub Actions YAML was parsed locally with the installed YAML parser: `pull_request`, `push(main)`, `workflow_dispatch` triggers and the dispatch-only validator are present. The new tests **2/2 GREEN**; historical scope tests (`tests/ci-change-impact-404.test.ts` 22/22, `tests/ci-change-impact-404-spreadsheet-next.test.ts` 4/4, `tests/ci-change-impact-404-wave4-20261013.test.ts` 3/3): **31/31 total**. Real `npm run tickets:test`: **5/5 PASS**, `git diff --check` PASS. No new dependency, no GitHub provider mutation, no source classifier edit, no Gold/source pin refresh, no release script changes.

**Actual strict validator refusal (NO_GO as expected):** Invoking `scripts/validate-release.ts --no-write-receipt --require-ready` on the 2026-10-13 checkout returned **exit 1**, `status=BLOCKED`, **0 errors/8 blockers**: `BROWSER_EVIDENCE_SOURCE_STALE`, `GOLD_RECEIPT_MISSING`, `GOLD_RECEIPT_NOT_GOLD`, `GOLD_RECEIPT_SOURCE_STALE`, two `PHYSICAL_DEVICE_EVIDENCE_MISSING`, `ROLLBACK_SOURCE_STALE` and `WORKTREE_DIRTY` (local code tranche). `gold`, `browserEvidence`, `physicalDeviceEvidence` and `rollback` were `BLOCKED`; `receipt=null`. These are genuine admissions blockers, never inferred review PASS. The CI workflow itself was **not run on GitHub** during this worker change; no live publish integration or physical/mobile/browser/security acceptance was performed.

**Manual branch/ref safety follow-up, independently RED→GREEN:** `workflow_dispatch` accepts a selected Git ref, so an otherwise passing preview branch could have been mistaken for a fully integrated `main` release candidate. The new negative test first failed `RELEASE_DISPATCH_MAIN_REF_NOT_GUARDED`. The workflow now executes a first-step `GITHUB_REF == refs/heads/main` assertion for manual dispatch (non-main dispatch fails red; it is not silently skipped with a green status). The exact YAML events, ref guard and validator conditional were parsed after this fix. Focused suite remains **31/31 PASS**, with no change to release scope/authority.

**Original AC disposition:** AC-404.1 improves materially (real cumulative Python tests and runnable strict admission gate), but **remains OPEN** until actual publish workflow is demonstrably gated on the same reviewed candidate and full source/device/rollback receipts. AC-404.2 stays **OPEN** for enforcement outside this source-only CI; this workflow accepts no labels as waivers but cannot physically prove reviews. AC-404.3 retains previous synthetic UI/Worker/engine mapping tests and new read-only release refusal evidence, but **remains OPEN** for the original huge/partial/cancel/real-consumer acceptance. This change is staged for prime source integration only; worker performed no commit/push or release. No dashboard edits; ticket remains `ready-for-agent`.

**Current broader check blocker (independent of these two owned source changes):** `npm run check` on the concurrently dirty source tree first passed `tickets:check` (0 mismatches), `format:coverage:check` (0 errors), and built the 269-tool catalog, then exited 1 at the unchanged `certification:check`: `certification output is stale: quality/receipts/expanded-catalog-certification.json`. It stopped before Astro compilation. The immutable certification artifact and unrelated live worker source changes were preserved; **no green broad check or release claim** is made. The focused #404 tests and actual Python unittests had already passed independently.
