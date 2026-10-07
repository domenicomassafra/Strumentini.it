# 276 — RIS BibTeX converter authoritative oracle closure

**What to build:** Resolve the remaining non-Gold ris-bibtex-converter blocker by selecting a sufficiently authoritative independent oracle/fixture corpus, documenting unsupported fields and regenerating certification evidence without weakening the Gold bar.

**Traces to:** AC-09.1; DEC-EXP-06

**Constraints:** C-EXP-01, C-EXP-02; do not self-certify with implementation output or lower oracle requirements.

**Blocked by:** None — can start immediately.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd

- [x] Oracle is independent of the implementation under test.
- [x] RIS↔BibTeX field mapping and known loss cases are explicit.
- [x] Gold receipt is regenerated only if all current certification requirements pass.

**Verification:** Independent fixture corpus plus certification receipt regeneration.

**Evidence (2026-10-06, revalidated):** The independent verifier passes 7/7 synthetic probes grounded in pinned Zotero translator expectations at commit `3d1c78530f42892328e08741b7cac8474ff687b8`; `ORACLE.md` records the supported mapping subset and known loss cases. `cand-187` is bound to that independent source at high confidence with no open gap for the declared subset. The Gold preflight passes, and `npm run gold:research-knowledge` freshly regenerated all 14 research receipts against the current oracle/fixture identities, including `ris-bibtex-converter.gold.json`. The earlier repository-wide `staleCount: 0` snapshot is no longer a current global claim because concurrent authority/catalog additions changed the shared registry and fixture hashes after that snapshot; those unrelated families must be rebound at final integration. The RIS/BibTeX receipt itself is current. Image Resize remains `PARTIAL` because its physical-device receipts are still absent.
