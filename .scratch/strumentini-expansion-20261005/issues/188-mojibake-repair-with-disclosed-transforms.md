# 188 — Mojibake repair with disclosed transforms

**What to build:** Add conservative encoding/mojibake repair modes with preview diff and change counts, refusing ambiguous conversions and preserving original text download.

**Traces to:** US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92 — Migrate TextWriting and list renderers to Result v2.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → code-tdd

- [x] Common UTF-8/CP1252 corruption patterns repair deterministically.
- [x] Ambiguous patterns warn/refuse rather than invent text.
- [x] Accepted repair is idempotent on second pass.

**Verification:** Encoding corpus, ambiguous cases and idempotence.

**Evidence (2026-10-06):** `repairMojibake` performs only the disclosed Windows-1252-byte → strict UTF-8 decode when mojibake signals decrease, otherwise preserves the original with a warning. Common accent/curly-apostrophe repair, refusal and second-pass idempotence are tested; the Result v2 renderer shows explicit Prima/Dopo. cand-235 binds `text-expansion`.
