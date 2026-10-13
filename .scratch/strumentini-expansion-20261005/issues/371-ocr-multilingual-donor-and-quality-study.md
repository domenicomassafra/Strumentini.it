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

## 2026-10-13 — native macOS Vision.framework OCR independent offline comparator (worker-10; desktop-only, NO_GO)

**Actual native capability and reuse:** On this arm64 macOS host, the **preinstalled Apple Swift 6.4** toolchain compiled a standalone `import Vision` / `VNRecognizeTextRequest` comparator; its runtime `supportedRecognitionLanguages()` includes both `it-IT` and `en-US`. No package, language model, skill, source/vendor asset, web API or remote provider was installed or requested. The existing local `scripts/ocr-language-audit-371.ts`, `tests/ocr-language-audit-371.test.ts` and the SHA-pinned original corpus are reused instead of building a new OCR engine. Two new owned files implement the *measurement seam only*: `scripts/ocr-native-vision-371.swift` (native macOS-only CLI) and `tests/ocr-native-vision-371-20261013.test.ts` (compile with preinstalled `/usr/bin/swiftc` to an ephemeral OS temporary directory, real local Vision invocation, no donor/runtime edits). The test explicitly **SKIPs/NOT_RUN outside arm64 macOS** (the GitHub Ubuntu runner cannot execute Vision; an Ubuntu skip is not a macOS performance PASS).

**Source/annotation and observed text:** Existing `spikes/heavy-local-feasibility/public/corpus/ocr-it.png`: **14,305 bytes**, **1280×240 PNG**, SHA-256 **`1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b`**, with unchanged independently recorded synthetic invoice annotation **`Fattura numero 12345 - Totale euro 678,90`**. Vision `recognitionLevel=.accurate`, `recognitionLanguages=[it-IT]`, automatic language detection **off**, language correction **off**, one top candidate per observation; its genuine recognized text (normalized only by collapsing whitespace) was **exactly `Fattura numero 12345 - Totale euro 678,90`**. Levenshtein on Unicode scalar values: **0/41 character edits (CER 0)**; on seven normalized words: **0/7 word edits (WER 0)**. A deliberately changed reference ending in `678,91` gave exactly **one** character and **one** word edit (**CER 1/41; WER 1/7**), confirming rates measure textual errors rather than model confidence. Native candidate score is **uncalibrated**, not probability or quality certification.

**Real local variant/performance snapshot (not stable head-to-head benchmark):** Native Vision on the *same* synthetic Italian source recognized all three cases **exactly, CER/WER=0**, including locally deterministically generated `sharp` grayscale (**SHA-256 `afa51af3dc64a5d9b1d728aab3b2a634b5a930ea56c67131721f349394867889`**) and raw uncorrected **90°** PNG rotation (**SHA-256 `3183478e9ca80f113a622d720baabd12cbbb65b185adb6d4470c525b44397dea`**). Final fresh local-native Vitest run measured request-only **upright 330.9 ms**, **grayscale 416.4 ms**, **rotated 442.5 ms**; a prior local run recorded **348.4 / 424.3 / 466.3 ms**, and an independently interpreted Swift cold launch had recognized upright in **3306.6 ms**. These numbers exclude binary compilation, process bootstrap and OS model warm/cold confounders; unlike a pooled engine benchmark, each test case runs in a separate native process. Prior local `tesseract.js@7.0.0` audit on the same source measured upright CER/WER 0 at 295.8 ms, grayscale 0 at 102.8 ms, **raw rotated misread** (CER 1.7561, WER 4.2857 at 198.7 ms), but the timestamps, process state and score semantics differ; **do not rank native vs WASM performance on this evidence**. Native `getrusage(RUSAGE_SELF).ru_maxrss` upright process high-water reported **51,593,216 bytes**, versus the previous Node audit's separate total-process sampled peak **141,959,472 bytes**; definitions are different and the native figure excludes unmeasured Vision/XPC or other subprocess memory, so **not** a device peak comparison. iOS/Android performance/memory **NOT_RUN**.

**Negative, privacy and boundary proof:** The comparator checks `O_NOFOLLOW` regular-file open, 64-byte minimum, **5 MiB maximum**, lowercase 64-hex SHA-256 match **before decoding**, PNG signature/IHDR, claimed width/height **before native ImageIO pixel allocation** (max 5000 per side and 2,000,000 pixels), one decoded image, a 512-scalar annotation and 4096-scalar output. It explicitly rejects changed digest, malformed/too-short image, >5 MiB input, >5000 pixel-claimed width, symlink substitution, invalid digest/CLI arguments and unapproved language; no user bytes, image or recognized text are sent to any service by this script. One *actual successful recognition of the original pinned fixture* ran under native macOS `sandbox-exec` kernel sandbox policy `(version 1) (allow default) (deny network*)`, confirming the local output can be produced while this process has **no permitted network access**. There is no process-wide/network-forensic claim beyond this sandboxed execution, nor proof about OS/XPC process egress for all possible consumer configurations. All output is JSON on stdout, refusals are `OCR371_REFUSED:<code>` on stderr with exit 2, and no source payload is persisted or uploaded. No native cancellation-during-recognition or physical mobile device test was performed.

**Observed validation and decision:** The new native suite **11/11 PASS** on this actual macOS host, including real Vision recognition and sandboxed denial of networking; in combination with the unchanged existing `tests/ocr-language-audit-371.test.ts` (**9/9 PASS**) and `tests/ocr-246-real-italian-fixture.test.ts` (**1/1 PASS**), the focused audit is **21/21 PASS**. The preexisting Tesseract warning `failed to load ./ita.special-words` remains nonfatal and is not suppressed. Strict scoped TypeScript and source whitespace checks are required before prime integration. The independent `en-US` availability list is **not** an OCR measurement: **no separately annotated, SHA-pinned English corpus** was prepared or scored, so **EN QUALITY NOT_MEASURED**, and `qualityComparableItEn` stays false. No new direct native/third-party redistribution approval is asserted. **Original AC-371.1 and AC-371.3 remain OPEN; AC-371.2 remains true as NO_GO; global product/OCR production #271/Gold/release NO_GO.** Prime alone handles reviewed source delivery and CI, and no worker Git stage/commit/push/merge/deploy, donor package edits or OCR #246 runtime changes were made.
