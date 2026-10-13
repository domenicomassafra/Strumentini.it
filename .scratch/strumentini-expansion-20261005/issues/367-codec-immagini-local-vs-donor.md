# 367 — Codec immagini local vs donor

**What to build:** Confronto jSquash installed native per JPEG WebP PNG AVIF SVG

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

- [ ] AC-367.1: Confronto jSquash installed native per JPEG WebP PNG AVIF SVG.
- [x] AC-367.2: Alpha/exif/CSP/perf non provati impediscono migrazione.
- [ ] AC-367.3: On the scoped input and failure cases, verify: Browser fixtures e benchmark memory device. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Browser fixtures e benchmark memory device. Test malformed/boundary/cancel and mobile as relevant.

**Failure / recovery:** Explicit size/format/memory limits after measurement; preserve original on refusal/cancel.

**External gate:** Rights, physical performance, security and owner purchase must pass before production; no gate presumed approved.

**Rollback:** Keep reversible migration to prior valid engine/bytes; protect historical receipts.

**Out of scope:** App implementation now, unapproved vendor spend, deploying incomplete safety features.

**Execution prompt:** Coordinated in EXECUTION-PROMPTS.md.

**Feasibility execution 2026-10-11:** Evidence and `NO_ADOPT / NO_GO` decision in `docs/donor-codecs-367-2026-10-11.md`. Isolated harness `scripts/donor-codecs-367.ts --browser`: Chromium, Firefox, WebKit real source output + Sharp/libvips byte/pixel re-open; focused `tests/donor-codecs-367.test.ts` 4/4 PASS. No @jsquash modules installed or measured. WebKit WebP MIME fallback correctly refused; native AVIF experimental 2×2 encode on WebKit only; EXIF retained/added on certain existing paths. AC-367.1 retains missing jSquash apples-to-apples codec benchmark/licensing; AC-367.3 retains real mobile peak memory, larger source corpus and production CSP. **Blocked on physical-device acceptance and rights/asset/provenance proofs. Do not close or migrate.**

## 2026-10-12 worker-24 wave21 — JPEG EXIF oriented display vs header, real browsers RED→GREEN

**New actionable defect on original local codec boundary:** `src/engines/image/format.ts`'s `inspectImageHeader` returned **coded JPEG** dimensions even when the browser's native `createImageBitmap(file, { imageOrientation: "from-image" })` returned a **display-oriented** bitmap after EXIF orientation 5–8. On an independent synthetic color-quadrant JPEG 6×4 with EXIF6 the header read **6×4**, while **both actual Chromium and WebKit** decoded and displayed **4×6**; independently rotated Sharp/libvips pixels confirmed the true displayed orientation. The resize UI uses the parsed dimensions for aspect lock/preview, so the mismatch produces a wrong geometry estimate; the previously installed local donor #047 also compares bitmap vs header and can reject a legitimate oriented JPEG. Initial browser test **RED in both**; no CSS/UI edit required.

**Bounded fix in the existing native header parser only:** parse the 0x0112 EXIF orientation tag from the TIFF IFD0 of JPEG APP1 with checked segment bounds and byte order (big/little endian), and swap width/height for display orientations 5–8. Scan only JPEG markers up to SOS rather than returning on first SOF: a second independent **RED** demonstrated that a real browser also honors an APP1 orientation segment placed **after** SOF. Reject conflicting Exif orientations or contradictory SOF dimensions rather than selecting an arbitrary profile; reject undersized SOF, and ignore invalid TIFF offsets rather than trusting corrupt metadata for rotation. No image bytes are modified, no full image decode is claimed by header preflight, and explicit AVIF/SVG unsupported types are **not** upgraded. Existing JPEG/PNG/WebP codec paths and prior MIME/refusal gates preserved.

**Source-bound verification:** new `tests/image-codec-367-wave21.browser.mjs` bundles the exact runtime source via installed esbuild on a local CSP-restricted loopback page, with network write/egress denied; **Chromium PASS, WebKit PASS** (desktop headless viewport 390px, not physical mobile). For each browser: EXIF orientations **1, 3, 5, 6, 7, 8**, and EXIF6 **APP1-after-SOF** source, compared native canvas RGB/dimensions against **independently** Sharp/libvips-decoded and rotated pixel matrix. Synthetic PNG and lossless WebP RGBA independently decoded, checked alpha exactly and opaque RGB; AVIF, SVG and arbitrary data explicitly refused, malformed TIFF pointer ignored, conflicting APP1 orientation and undersized SOF refused; zero browser page errors and zero upload/offsite request. Existing `tests/image-resize-engine.test.ts`, `tests/donor-codecs-367.test.ts`, `tests/image-compression-donor-047.test.ts` **15/15 PASS**; `node --check` and `git diff --check` PASS. Test makes no claims about decoding unsupported types or output OS persistence.

**Scope/gates:** original **AC-367.1 and AC-367.3 OPEN**, pre-existing AC-367.2 checked as NO_GO fence. No @jsquash donor installed, no wasm/license/provenance/mobile device/peak-memory/production CSP benchmark or user-visible migration: **NOT_RUN / NO_ADOPT** remains. Only parser, new test and this original ticket edited, no dependency/provider/commit/push/deploy.

**Controllo TypeScript globale concorrente (non GREEN):** `astro check` su **2033 file: 1 errore, 0 warning, 24 hint**. L'unico errore `ts(2322)` è in `tests/heavy-local-memory-363-wave21.test.ts:177` (file nuovo fuori ownership #367 del worker #363: `string | undefined` non assegnabile a `BlobPart`); nessuna diagnostica indica `format.ts` o il test browser #367. Report separato al coordinatore, **non** dichiarare un pass globale.

## 2026-10-13 worker-9 — PNG eXIf display orientation vs IHDR, browser RED→GREEN

**Actual new native parser defect:** PNG with `eXIf` TIFF orientation 5–8 has coded IHDR width×height that differs from the pixels displayed by `createImageBitmap({ imageOrientation: "from-image" })`. Sharp/libvips PNG 6×4 with orientation 6 independently reopens and rotates to **4×6**, as do Chromium, Firefox and WebKit. Before the fix `inspectImageHeader` returned **6×4**; the new source-bound browser regression `tests/image-codec-367-20261013-png-exif.browser.mjs` was **RED in all 3 engines** at EXIF 5. This affects local image resize preflight/aspect calculations and donor #047's decoded-bitmap vs header-dimensions equality check. No media bytes or metadata are rewritten by the parser.

**Minimal bounded fix:** `src/engines/image/format.ts` scans PNG ancillary chunks preceding `IDAT` for valid `eXIf`, reusing the existing TIFF endian/IFD reader used by JPEG; reported axes swap for orientations 5–8. It refuses contradictory orientation chunks, corrupted `eXIf` CRC and incomplete pre-IDAT metadata, and validates the IHDR length before advancing. Real Chromium/WebKit ignore an `eXIf` with damaged CRC (render coded 6×4), even though Sharp's metadata getter still reads its orientation, so rejecting that CRC is an observed source-bound safety requirement. Both browser and Sharp ignore a valid `eXIf` moved **after** `IDAT`; the parser deliberately stops scanning at IDAT. Header-only preflight still does **not** claim full PNG decode/CRC verification.

**Verification:** RED before source fix on Chromium/Firefox/WebKit; after fix 3/3 real browser engines PASS × **9 decoded PNG fixtures per engine** (original, EXIF 1/3/5/6/7/8, valid Motorola big-endian EXIF6, EXIF6-after-IDAT ignored) with dimensions and color-quadrant pixel matrices independently compared to Sharp/libvips. Negative browser checks pass for contradictory eXIf, corrupt CRC ignored by native decoder and parser refused, and truncated Exif refused; no external network requests. Previous `tests/image-codec-367-wave21.browser.mjs`: Chromium and WebKit PASS. Focused Vitest image resize/donor #047/codec #367: **15/15 PASS**. `npx astro check` **2057 files: 0 errors, 0 warnings, 24 hints** (the hints are outside this scope). `node --check` and `git diff --check` PASS.

**Scope:** Original AC-367.1 and AC-367.3 stay **OPEN**; AC-367.2 still a NO_GO fence. Installed jSquash comparison, license/transitive proofs, physical iOS/Android device memory, production CSP and broad benchmark are **NOT_RUN**. No Gold claim, donor adoption, release or ticket closure.
