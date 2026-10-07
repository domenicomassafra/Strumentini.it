# 97 — Migrate image shared renderers to Result v2

**What to build:** Migrate ImageVisualTool, image-resize and bespoke image surfaces to preview plus dimensions/format/bytes before→after while preserving current certification truth.

**Traces to:** US-EXP-01, US-EXP-04; AC-01.1, AC-04.1

**Constraints:** C-EXP-01, C-EXP-02, C-EXP-04, C-EXP-05; never fabricate physical-device evidence.

**Blocked by:** 78, 81, 82.

**Status:** completed

**Suggested skills:** design-impeccable → inclusive-design → code-tdd → qa-browser

- [x] All assigned image ids have image/file result semantics.
- [x] Preview/facts derive from actual decoded/output artifact.
- [x] image-resize stays Partial until genuine physical blockers close.

**Verification:** Existing image acceptance/Gold where applicable plus desktop/mobile result fixtures.

**Evidence:** the generated Result v2 inventory reports all 20 owner-97 ids declared (9 calculator, 8 image, 3 validator). Image Result v2, image-visual and image-resize focused suites pass 20/20. The dedicated image-resize browser acceptance passes output dimensions/format, local-only requests, cancellation, corrupt/oversized input and 390px behavior; marketing/media browser acceptance passes current image/QR/privacy routes including EXIF byte proof. Artifact-backed previews and facts remain verifier-bound. The functional-audit/certification truth for image-resize is not promoted: physical Android/iOS evidence and the promotion gate remain open under tickets 277, 278 and 279.
