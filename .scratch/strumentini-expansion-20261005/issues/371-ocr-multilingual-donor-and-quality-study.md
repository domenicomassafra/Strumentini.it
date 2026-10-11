# 371 — OCR multilingual donor and quality study

**What to build:** Misura OCR IT EN con motore esistente e alternative

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

- [ ] AC-371.1: Misura OCR IT EN con motore esistente e alternative.
- [x] AC-371.2: Language pack privacy/licenza/mobile non dimostrati no-go.
- [ ] AC-371.3: On the scoped input and failure cases, verify: Corpus annotated and device memory. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Corpus annotated and device memory. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

## Incremental offline donor/quality audit — 2026-10-11 source snapshot

**Policy outcome: `NO_GO` for multilingual comparison and production.** New
`scripts/ocr-language-audit-371.ts` executes solely on explicitly pinned local
assets, with no download/install/cloud paths; it returns structured evidence
and deliberately exits with **code 2** because an open gate must not be confused
with a green acceptance result. The new negative/measurement suite is
`tests/ocr-language-audit-371.test.ts`.

- **Actual donor available:** isolated local `tesseract.js@7.0.0`
  (`Apache-2.0`), `tesseract.js-core@7.0.0` (`Apache-2.0`),
  `@tesseract.js-data/ita@1.0.0` (package metadata `MIT`; upstream
  redistribution record `Apache-2.0`). The model is **6,933,830 bytes**
  SHA-256 `21c1bfde62571d76b923e270bb2cde583ccc18fa8bfd83454c021b28d8b5cb5a`.
  Package versions, source corpus manifest, four included license notices,
  model digest and immutable #246 donor evidence hash
  `0f9200cabd3dc3bd2d89c2473c3836473008d8a997d13cfbcf78249f9ad0d9b4`
  are checked before starting the local worker. Native Tesseract CLI was not
  found in the inspected host PATH; native/macOS Vision and commercial vendor
  alternatives remain `NOT_MEASURED` / `NO_GO` without comparable authorized
  source, contract and license/cost evidence.
- **Real annotated IT corpus:** 1280×240, 14,305-byte locally generated
  synthetic invoice `spikes/heavy-local-feasibility/public/corpus/ocr-it.png`,
  SHA-256 `1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b`,
  reference text `Fattura numero 12345 - Totale euro 678,90`. On
  **Mac Studio darwin/arm64 Node 26.10.0**, actual local worker returned:
  upright exact, CER **0**, WER **0**, engine score **94**, **295.8 ms**;
  deterministic grayscale exact, CER **0**, WER **0**, score **94**,
  **102.8 ms**; deterministic raw 90° rotation **incorrect**, CER
  **1.7561**, WER **4.2857**, score **51**, **198.7 ms**.
  CER/WER are edit-distance counts divided by reference length and can exceed
  1 with insertion-heavy errors. Tesseract confidence is uncalibrated and is
  **not** interpreted as a percentage probability of correctness.
- **Memory measured with clear limit:** Node process RSS sampled every 20 ms
  around worker start, three recognitions and termination: from
  **43,275,736 bytes** before worker to **138,993,968 bytes** after worker
  initialization; highest sampled total process RSS **141,959,472 bytes**;
  worker initialization **761.5 ms**. This includes the Node process and is
  neither an isolated WASM/native-memory figure nor a guaranteed instantaneous
  peak. iOS Safari/Android Chrome physical peak memory and behavior
  **NOT_RUN**, cancellation during recognition **NOT_RUN**.
- **English expressly refused:** no installed, hash-pinned and licensed EN
  language package/model in the isolated OCR stack, and **no independently
  annotated English OCR fixture** in the local corpus. The script reports
  `EN_MODEL_UNPINNED`, `EN_CORPUS_UNANNOTATED`,
  `EN_LICENSE_AND_DISTRIBUTION_UNVERIFIED`, **zero measured English cases**
  and `qualityComparableItEn: false`; it never substitutes the Italian
  model or claims bilingual quality. No comparable real scanned documents
  for IT/EN, no mobile language-asset/privacy egress measurement, no
  production approval.

**Verification:** initial focused Vitest RED (audit module absent),
then GREEN `./node_modules/.bin/vitest run
tests/ocr-language-audit-371.test.ts
tests/ocr-246-real-italian-fixture.test.ts` = **2 suites, 10/10 PASS**.
Independent isolated `tsc --ignoreConfig --noEmit` on the new script/test
**PASS**. Actual `tsx scripts/ocr-language-audit-371.ts` exercised the
local donor and printed the result above, ending with **intentional exit 2
NO_GO**. Negative tests cover absent English model/corpus, missing model,
model substitution, modified source digest, altered/unverified donor license
evidence, low-quality rotated text and nonfinite confidence with worker
termination. Existing Tesseract `ita.special-words` warning persists
without failing the observed Italian recognition; it is not a quality
guarantee or a promotion exception.

**Original AC still OPEN:** AC-371.1 requires actual comparable IT/EN and
alternatives on an admitted corpus; AC-371.3 requires more than one synthetic
source, independently checked scan quality and physical device total-memory
data. AC-371.2 is satisfied as an explicit demonstrable `NO_GO` contract
when rights, privacy or mobile proof is absent. No production engine, Gold,
historical receipts, public route, deployment, model download or existing
product files were changed. Historical #271 production refusal stands.
Repository-wide `./node_modules/.bin/astro check` after the scoped
TypeScript fixes: **2023 files, 0 errors, 0 warnings, 23 nonfatal hints**
(all hints outside #371 files).
