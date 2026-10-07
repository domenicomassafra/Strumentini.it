# 03 — Migrate text/research/developer results

**What to build:** Migrate the 62 existing tools in `developer-web` (20), `research-knowledge` (20), `text-writing` (19), `text-list` (2), and `research-reference` (1) to Result v2 with selectable/editable outputs, precise validation errors, copy/download, counts, provenance, and bounded large-output previews.

**Traces to:** US-EXP-01, US-EXP-05; AC-01.1, AC-01.2, AC-05.1; DEC-EXP-03; C-EXP-01, C-EXP-04, C-EXP-09

**Constraints:** Raw JSON/code may remain an optional technical representation but cannot be the default human result where a clearer answer exists.

**Blocked by:** 91, 92, 93.

**Status:** completed

- [x] 62/62 engine entries have declared result semantics.
- [x] Validators identify failing rule/location; transforms expose copy/download and change counts where meaningful.
- [x] Large outputs are preview-bounded without data loss in the downloadable result.

**Verification:** Generated 62/62 coverage assertion plus existing Gold tests and representative accessibility/mobile browser acceptance.

**Evidence:** child tickets 91, 92 and 93 are completed, covering 20 developer + 21 text/list + 21 research/reference ids for 62/62 declared semantics. Developer, text and research browser/Gold lanes pass; long-output fixtures retain complete artifacts beyond bounded previews. Research provenance remains separate from user content, and the RIS/BibTeX authoritative-oracle gap remains truthfully REFUSED rather than being promoted by the UI migration.
