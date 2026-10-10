# Future execution packet — planning only

This is an executable instruction draft, NOT a presently authorized development assignment or release approval. When the owner opens an implementation session, read the latest source revision, the exact canonical ticket source and its original acceptance, the OWN handoff, PRODUCT-SPEC-2026-10-10-EXPANSION.md, ROADMAP.md, SKILL-ROUTING.md, donor matrix and four native worker proposals. Do not repeat grilling questions already decided.

Use the smallest pre-approved scope and existing engine/test seams, compare installed/native options before a donor, and do not implicitly install dependencies or buy a commercial license. Implement/test only after genuine numeric, security, legal, device and visual gates. A historic refusal or original checked AC on a partial subset does not mean capability shipped. If the gate is unmet, produce bounded evidence/NO-GO and no public-facing claim. A UI mock cannot prove output correctness. Do not deploy, push or purchase without a separately authorized owner release decision.

Verification on a later code change: attach exact source/Worker/asset fingerprints, fixture hashes, reproducible test command and independent real output reopen; failures for invalid/malformed/large/unsupported/cancel/denied storage, resource bounds, privacy and rollback. Physical mobile iOS Safari/Android Chrome are real physical evidence only, not viewport simulation. Annual legal rates are dated primary-source snapshots, never guessed. Report passed/not-run/stale/failed criteria individually and a reversible rollback plan.


## Tranche: 10-mobile-server-media

Require physical devices and explicit user consent/zero extra cost for any server processing, memory-bounded media and project storage.

## Exact canonical issues and acceptance contracts

### # 35 — Audio capture/playback utilities

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/35-audio-capture-playback-utilities.md
Prerequisites: 229, 303, 304.


- [ ] Mic/recorder permission and denial states are accessible and recoverable.
- [ ] Tone/metronome/noise timing and stop controls remain reliable when the tab changes state within documented browser limits.
- [ ] TTS lists actual browser voices rather than promising unavailable voices.

Specific verification: Media-permission browser tests, generated-audio frequency/timing checks, local-only network assertion, and mobile permission acceptance.

### # 229 — Microphone test and local recorder

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/229-microphone-test-and-local-recorder.md
Prerequisites: Genuine physical-device acceptance. The host still has no verifiable Android target/tooling, and the paired iPhone is currently unavailable; the last reachable iOS attempt also had Web Inspector disabled. WebDriver mock media cannot substitute for live microphone permission/capture evidence.


- [x] No permission prompt before explicit user action.
- [x] Deny/revoke/unsupported states recover.
- [x] Recorded duration/type/size are derived from actual Blob/media support.

Specific verification: `tests/browser-audio-utilities.test.ts` is 6/6 PASS and `scripts/acceptance-microphone-recorder.mjs` passes explicit permission, deny→retry, revoke→retry, runtime MIME, pause/resume/stop, actual Blob type/bytes, local download, zero external requests, unsupported recovery and 390 px overflow checks. `npx astro build` emits `/tools/microphone-recorder/`. A bounded physical iOS attempt was run on iPhone 14 Pro Max `00008120-0006384E14D8201E`, iOS 26.6.2 build 23G90, Safari/safaridriver 26.6.2 (21624.5.1.11.3). safaridriver found the exact physical device but refused the session because Web Inspector is disabled; `devicectl` proved the phone fetched the route over LAN but cannot drive the real page/native permission UI through its exposed CLI. safaridriver also documents that WebDriver sessions replace live media capture with mock capture devices, so a WebDriver mic run would not satisfy the physical permission/live-microphone requirement even after enabling Web Inspector. See `evidence/ticket229-physical-ios-attempt-20261006.md`. On the 2026-10-07 recheck the phone remains paired but reports `State=unavailable` with last connection on 2026-10-06 at 22:19; `adb` is still absent from PATH and the common Homebrew locations. No physical PASS receipt was created; physical permission/record/download/no-crash remains blocked.

### # 277 — Physical Android Chrome image-resize acceptance

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/277-physical-android-chrome-image-resize-acceptance.md
Prerequisites: No verifiable physical Android Chrome target is currently reachable from this host; `adb` is not installed/exposed in PATH or the common Homebrew locations.


- [ ] Receipt identifies real device/browser/build fingerprint.
- [ ] Resize interaction, output dimensions/type/bytes and download are verified on-device.
- [ ] No desktop emulation result is promoted as physical evidence.

Specific verification: Physical Android Chrome run with screenshots/console/output artifact receipt.

### # 278 — Physical iOS Safari image-resize acceptance

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/278-physical-ios-safari-image-resize-acceptance.md
Prerequisites: The paired physical iPhone is available again, but SafariDriver cannot create a physical Safari session because Web Inspector is disabled on the device. Web Inspector must be enabled before the real Files/Photos picker, resize and download boundary can be exercised.


- [ ] Receipt identifies physical iOS/Safari/build fingerprint.
- [ ] File picker/resize/download and output facts are verified on-device.
- [x] Failure/limitation remains a blocker rather than being masked by desktop WebKit.

Specific verification: Physical iOS Safari run with screenshots/console/output artifact receipt.

### # 279 — Image-resize Gold promotion gate

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/279-image-resize-gold-promotion-gate.md
Prerequisites: 277, 278.


- [ ] All required receipts reference compatible/current source fingerprint.
- [ ] Any physical failure keeps status Partial.
- [ ] Promotion updates certification artifacts without bypass flags.

Specific verification: Certification validator plus fresh image-resize receipt consistency check.

### # 280 — Physical Android heavy-tool web acceptance lane

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/280-physical-android-heavy-tool-web-acceptance-lane.md
Prerequisites: 206 — Heavy local-job mobile and performance acceptance gate.


- [ ] Lane records device/browser/build and exact route/input class.
- [ ] OOM/unsupported state is recoverable and captured as failure/limit.
- [ ] Receipt schema can be consumed by heavy-route promotion gates.

Specific verification: Representative accepted heavy route on real Android plus artifact verification.

### # 281 — Physical iOS Safari heavy-tool web acceptance lane

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/281-physical-ios-safari-heavy-tool-web-acceptance-lane.md
Prerequisites: 206 — Heavy local-job mobile and performance acceptance gate.


- [ ] Lane uses physical iOS Safari and records current build fingerprint.
- [ ] Safari resource/Blob/download constraints are measured per representative route.
- [ ] Unsupported behavior remains an explicit limitation, not a desktop WebKit substitution.

Specific verification: Representative accepted heavy route on real iOS Safari with artifact/console evidence.

### # 348 — Server opt-in gratis feasibility

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/348-server-opt-in-gratis-feasibility.md
Prerequisites: None


- [ ] AC-348.1: Comparare locale/server per quota hard costo e consenso.
- [ ] AC-348.2: Over-quota fallback locale o indisponibile, mai upload silenzioso.
- [ ] AC-348.3: On the scoped input and failure cases, verify: Budget/stress/threat model. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Budget/stress/threat model; independently inspect output/record and test bounded failures.

### # 349 — File server opt-in TTL delete prova

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/349-file-server-opt-in-ttl-delete-prova.md
Prerequisites: 348


- [ ] AC-349.1: Se approvato upload esplicito ha retention/cancellazione verificabile.
- [ ] AC-349.2: Retry partial e leak tra utenti falliscono chiuso.
- [ ] AC-349.3: On the scoped input and failure cases, verify: Staging storage audit e TTL. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Staging storage audit e TTL; independently inspect output/record and test bounded failures.

### # 362 — Device fisici mobile file-result-share

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/362-device-fisici-mobile-file-result-share.md
Prerequisites: 336,337


- [ ] AC-362.1: iPhone+Android reali eseguono job completo con byte apribili.
- [ ] AC-362.2: Picker denied/share fail/background recovery.
- [ ] AC-362.3: On the scoped input and failure cases, verify: Device+OS+browser+fingerprint receipt. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Device+OS+browser+fingerprint receipt; independently inspect output/record and test bounded failures.

### # 363 — Budget memoria mobile editor reali

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/363-budget-memoria-mobile-editor-reali.md
Prerequisites: None


- [ ] AC-363.1: Misurare device memoria/frame/input S M L per editor futuri.
- [ ] AC-363.2: OOM e cancel non devono corrompere risultato.
- [ ] AC-363.3: Misurare su iOS Safari e Android Chrome fisici con modello/OS/browser/revisione noti fixture sintetiche S/M/L di PDF, immagini e CSV; acquisire budget/process evidence disponibile, cold/warm, background, annullamento e reopen output. Hardware assente resta NOT_RUN senza simulare soglie universali.

Specific verification: Real device traces con dati sintetici; independently inspect output/record and test bounded failures.

### # 403 — Physical microphone and audio media continuation

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/403-physical-microphone-and-audio-media-continuation.md
Prerequisites: 229


- [ ] AC-403.1: Record and reopen actual audio capture on physical platform.
- [ ] AC-403.2: Permission denied/muted/background no imaginary recording.
- [ ] AC-403.3: On the scoped input and failure cases, verify: Physical iOS/Android/desktop mic audit. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Physical iOS/Android/desktop mic audit; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

### # 411 — Audio video large file mobile progress and cancel

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/411-audio-video-large-file-mobile-progress-and-cancel.md
Prerequisites: 363


- [ ] AC-411.1: Media tools state progress and real mobile resource limits.
- [ ] AC-411.2: Browser suspension and unsupported codec provide clear recovery.
- [ ] AC-411.3: On the scoped input and failure cases, verify: Physical mobile conversion and memory checks. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Physical mobile conversion and memory checks; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

### # 412 — Editor project schema and forward-safe migrations

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/412-editor-project-schema-and-forward-safe-migrations.md
Prerequisites: 341,379,385


- [ ] AC-412.1: PDF/image projects versioned and restorably migrated with opt-in save.
- [ ] AC-412.2: Unknown schema or missing files fail without destructive update.
- [ ] AC-412.3: On the scoped input and failure cases, verify: Old/new project fixtures and backup restore. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Old/new project fixtures and backup restore; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

### # 424 — Audio transcode target bitrate and compression feasibility

Authority: /Users/domenico/Code/Strumentini.it/.scratch/strumentini-expansion-20261005/issues/424-audio-transcode-target-bitrate-and-compression-feasibility.md
Prerequisites: 363


- [ ] AC-424.1: Compare browser native/installed/donor codecs and device acceptable size/quality.
- [ ] AC-424.2: Unsupported encoder/codec on Safari refuses rather than fake output.
- [ ] AC-424.3: On the scoped input and failure cases, verify: Audio signal fidelity bitrate/container independent playback. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

Specific verification: Audio signal fidelity bitrate/container independent playback. Test malformed, hostile, huge, cancellation and device limitations.

## Execution sequence (only when separately assigned)

1. Select a dependency-ready slice; name the exact issue and existing source code owner. STOP if owner choice/license/security/official source/device gate is unresolved; research-only may continue.
2. Define the minimum verifiable vertical behavior and fail-closed unsupported behavior. Derive benchmarks from actual fixtures, no invented performance ceilings.
3. Implement only the selected issue with focused tests; compare true downloaded/reopened output, cross-browser/accessibility and iOS/Android physical where the issue requires it.
4. Run targeted regression and evidence identity checks; before an actual promotion, run separate full release + preview + rollback checklist. Never write synthetic Gold or physical receipts.
5. Report per-AC PASS/FAIL/NOT_RUN with paths/digests, changes, independent proof, rollback, unresolved dependencies; request separate owner permission for purchase, design selection or deploy.
