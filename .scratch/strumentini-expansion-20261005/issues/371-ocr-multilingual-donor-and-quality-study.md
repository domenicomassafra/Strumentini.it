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

## 2026-10-13 — independent native Vision FIFO P2 correction (worker-13; Draft PR #25)

**Actual RED:** Independent Standards+Spec audit on Draft PR #25 original remote SHA `5708e27604d3569d08e60ff72675fb5360741ed9` found that `open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)` blocked indefinitely on a real FIFO with no writer, before `fstat` could reject the nonregular descriptor. The new isolated `tests/ocr-native-vision-371-20261013-fifo.test.ts` compiles the genuine Swift comparator with the preinstalled `/usr/bin/swiftc`, creates a named pipe through `/usr/bin/mkfifo`, and invokes the native binary with a 1.5-second bounded child timeout. On the original source the test was **RED 1/1**, producing `spawnSync ... ETIMEDOUT` instead of the required refusal; the subprocess was killed and its temporary directory cleaned.

**Minimal source fix and GREEN:** `scripts/ocr-native-vision-371.swift` now opens inputs with `O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC` before `fstat`. `O_NONBLOCK` prevents the FIFO-open wait; `fstat` reliably rejects the FIFO as `OCR371_REFUSED:UNSAFE_FILE` (exit 2, empty stdout). The existing same-descriptor `fstat`/bounded read and `O_NOFOLLOW` symlink protection remain intact. Fresh arm64 macOS `vitest` runs of the 11 original Vision cases, the new FIFO regression, nine original OCR #371 language-audit tests and the #246 pinned-fixture case yield **4 suites, 22/22 PASS**; original symlink and SHA checks, real sandbox deny-network recognition, and the reference Italian OCR (CER/WER 0) remain GREEN. Scoped `tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node tests/ocr-native-vision-371-20261013-fifo.test.ts` and `git diff --check` passed. On non-arm64 macOS the native tests explicitly skip / are `NOT_RUN`, including Ubuntu CI; no new assets, donors or dependencies were introduced. **English OCR quality NOT_MEASURED, mobile/device memory NOT_RUN, rights/privacy release gates OPEN, AC-371.1/.3 OPEN, AC-371.2 remains NO_GO, and Gold/product/release NO_GO.** Integration and remote PR updates belong to prime; this worker made no Git writes or PR comments.

## 2026-10-13 — independent English native fixture and reporting P2 (worker-6, source-only)

**Original AC and candidate:** Audited original #371 at detached `c38da86458eec0512721a5b4abc612b1f7b74a67` on actual macOS arm64. Existing local `tesseract.js@7.0.0` has only the pinned Italian traineddata, no locally licensed/pinned English language pack; preinstalled Apple Vision recognizes `en-US` without a new download. New *test-only* `tests/ocr-371-20261013-native-english-annotated.test.ts` renders an English SVG line through installed local `sharp@0.35.5` into an actual **1280x240, 14,270-byte PNG** (SHA-256 `5cb42f37588b446ed54e8193caf6a3361bdacb81a8128fc50150987c6c6212e0`) and verifies its exact digest and byte count **before** passing it to a freshly compiled real Swift Vision process. The fixture text is `Invoice number 12345 - Total USD 678.90` (39 Unicode scalars, seven words); this is a deterministically annotated **synthetic rendering**, not an independent human-transcribed real document. A separate actual 90-degree PNG is independently hashed and pinned (20,172 bytes, SHA-256 `a839a458bad2ab4846312b822b4661d873ede579d9abb1855ca36e1681a7fcc9`). Both native `en-US` OCR runs returned the exact English reference, **CER 0, WER 0**; the explicit wrong-hash invocation exited 2 with empty stdout and `OCR371_REFUSED:SOURCE_SHA256_MISMATCH`. English original-image recognition also succeeded under `sandbox-exec '(deny network*)'` for this native process. These small printed single-line samples cannot establish real-scan or mobile quality.

**Actual source P2 RED→GREEN:** The native CLI previously returned `scope: MACOS_VISION_LOCAL_SINGLE_HOST_SYNTHETIC_IT_ONLY` *even after a successful `en-US` English recognition*. The new real native fixture regression was **RED 1 failed / 1 passed** with an exact `scope` mismatch while its extracted text and CER/WER were correct. Bounded source fix: `scripts/ocr-native-vision-371.swift` now selects `..._IT_ONLY` for `it-IT` (unchanged Italian output) and `..._EN_ONLY` for `en-US`, preserving `decision: NO_GO`, `englishComparativeQuality: NOT_MEASURED`, native/XPC peak `NOT_MEASURED`, physical devices `NOT_RUN` and local-only language settings. This corrects evidence attribution without asserting an English Tesseract comparison.

**Fresh engine evidence (same Mac, distinct runtime/process conditions):** Re-ran the unmodified real Tesseract audit `tsx scripts/ocr-language-audit-371.ts` (deliberate exit **2 NO_GO**): native `tesseract.js` IT model SHA-256 `21c1bfde62571d76b923e270bb2cde583ccc18fa8bfd83454c021b28d8b5cb5a`; pinned IT upright CER/WER **0/0**, score **94**, **402.9 ms**; grayscale **0/0**, score **94**, **105 ms**; uncorrected 90-degree rotated IT **CER 1.7561 / WER 4.2857**, score **51**, **287.2 ms**. Model initialization **512.3 ms**, Node total-process sampled RSS max **144,121,992 bytes** (not isolated WASM peak). On the same original IT PNG, serial native Vision run recognized upright/grayscale/rotated at CER/WER **0/0**; request-only observed **1198.7 / 1140.2 / 642.8 ms**. New EN original/rotated real Vision serial samples: CER/WER **0/0**, request-only **818.7 / 481.5 ms**, native process rusage max RSS **49,119,232 / 52,592,640 bytes**. These are *noncomparable* warm/cold host samples with different worker/process/memory accounting; no speed winner or mobile process peak is claimed. Scores from both engines are uncalibrated.

**Validation, concurrency qualification and explicit disposition:** Native/macOS focused test suite with `vitest run --no-file-parallelism --maxWorkers=1` across new EN test, existing Vision Italian, native FIFO, language audit and real Italian Tesseract fixture: **5 suites, 26/26 PASS**. Default parallel run gave **25/26** because the existing 1.5-second FIFO refusal deadline timed out amid three concurrent Swift compilations and native OCR processes; serial rerun independently passed the same FIFO case in **322 ms**. This resource/contention observation is retained and is **not** evidence for reliable performance under concurrent load. New English test scoped `tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node` **PASS**; `git diff --check` **PASS**. No native donor/OS package/provider installation, browser/app OCR changes, model download, Git stage/commit/push, PR, device or release action. **Original AC-371.1 OPEN** (no pinned English Tesseract model, matched multi-engine English quality or real scanned bilingual corpus), **AC-371.2 checked NO_GO**, **AC-371.3 OPEN** (independent real scan annotations, physical iOS/Android memory/performance/cancel and privacy/resource gates unmeasured). Product/Gold/release and #271 stay **NO_GO**. Prime owns integration and external review.
