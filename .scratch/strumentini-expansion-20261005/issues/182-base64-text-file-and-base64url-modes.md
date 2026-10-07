# 182 — Base64 text file and base64url modes

**What to build:** Deepen existing Base64 tool with text and arbitrary-file byte modes plus distinct base64url, bounded local files and precise invalid-padding diagnostics.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 91, 76.

**Status:** completed

**Suggested skills:** security-audit → code-typescript → code-tdd → inclusive-design

- [x] Raw file/byte mode round-trips arbitrary byte values exactly through `encode-bytes` / `decode-bytes` with a bounded 512 KiB local-file policy.
- [x] The existing UTF-8 text mode remains separate from the new raw-byte/file panel; decoded raw bytes are downloaded instead of being coerced through UTF-8.
- [x] Base64url is a visible alphabet choice; generated output is unpadded and decode accepts only canonical optional padding with precise length/padding/character diagnostics.

**Verification:** `tests/developer-web-engine.test.ts` covers arbitrary binary bytes, standard/Base64url round trips and invalid padding. The `Base64CodecTool` file panel uses a real browser `File`/`ArrayBuffer` path and downloads decoded bytes as `application/octet-stream` without network or URL persistence.
