# 327 — Research dedupe identity and citation export audit

**What to build:** Deepen remaining research dedupe/sort/key/source tools around explicit identity keys, collision handling and export provenance, while leaving ris-bibtex Gold closure to ticket 276.

**Traces to:** US-EXP-01, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 93, 198, 276.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → inclusive-design

- [x] `research-citation-identity` publishes the stable identity chain (DOI → ISBN → URL → title/author/year → stable record content), reports the rule used for every group and preserves first-seen order.
- [x] Conflicting records that share an identifier are never field-merged: one remains the canonical record while the other remains explicitly present in `duplicates` and the indexed identity group; multiset conservation and idempotence are property-tested.
- [x] Affected original research routes have ticket-110 functional-audit records; RIS/BibTeX is explicitly `UPGRADED`, while citation dedupe/key/sort/evidence/reading-list routes are recorded as `ALREADY_COMPLETE` with current shared-engine ownership.

**Verification:** `quality/fixtures/research-citation-identity/vectors.json` covers DOI form collisions, ISBN-10/13 equivalence, URL credential redaction, empty identities, title/author/year conflicts and key collisions. `tests/research-knowledge-engine.test.ts` checks group rules, idempotence, multiset conservation, sorter stability and RIS/BibTeX boundaries; ticket 198 adds CSV identity/export coverage without inventing missing metadata.
