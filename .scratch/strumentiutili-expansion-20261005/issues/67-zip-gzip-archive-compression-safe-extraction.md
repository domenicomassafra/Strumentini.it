# 67 — ZIP/GZIP/archive compression + safe extraction

**What to build:** Upgrade current ZIP creation from `store` to real DEFLATE compression with level presets, add GZIP compress/decompress for single files, safe ZIP extraction, and feasibility-gated 7z/RAR inspection/extraction where a maintained local dependency is acceptable.

**Traces to:** US-EXP-04, US-EXP-09, US-EXP-10; AC-04.1, AC-04.2, AC-06.1, AC-10.1; DEC-EXP-02, DEC-EXP-05, DEC-EXP-06; C-EXP-05, C-EXP-08

**Constraints:** Reject path traversal/absolute paths/unsafe overwrite; encryption/password creation or extraction is added only with an audited library; no brute force; large archives are memory-bounded and cancellable.

**Blocked by:** 01, 34.

**Status:** blocked

- [ ] ZIP creator offers store/fast/balanced/max compression and reports per-entry + total savings.
- [ ] GZIP round-trips bytes and validates integrity where format support allows.
- [ ] ZIP extraction previews paths/sizes first and refuses traversal/unsafe entries.
- [ ] 7z/RAR remains `SPIKE/REFUSE` until licensing/mobile/performance evidence is acceptable.

**Verification:** Compression-ratio corpus, exact byte round-trips, zip-slip/path-traversal adversarial fixtures, corrupted archive handling, cancellation/memory receipts.

