# 300 — Image Base64 local encode decode mode

**What to build:** Add image↔Base64/data-URL conversion as a bounded mode reusing file signature and Base64 primitives, keeping raw bytes local.

**Traces to:** US-EXP-04, US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 97, 182.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → inclusive-design

- [x] Image decode validates the reconstructed bytes with the existing JPEG/PNG/WebP header/signature parser before offering a download; unsupported/corrupt bytes fail explicitly.
- [x] Plain Base64 and `data:<mime>;base64,...` are distinct modes; data-URL decode rejects a declared MIME that disagrees with the decoded signature.
- [x] Image/file input is bounded by the existing 512 KiB Base64 byte limit, the UI previews at most 12,000 encoded characters, and the complete encoded text or decoded image bytes remain downloadable.

**Verification:** `tests/developer-web-engine.test.ts` covers Base64 byte primitives; image-mode tests cover PNG/JPEG/WebP signature verification, byte round trip and wrong-MIME refusal. The existing Base64 route provides the bounded preview/complete-download browser surface without adding a duplicate public route.
