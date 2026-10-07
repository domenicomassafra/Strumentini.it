# RIS/BibTeX independent oracle and loss map

Ticket 276 requires an oracle that is independent from the StrumentiUtili.it converter. The cross-check in this directory uses the maintained Zotero RIS and BibTeX translators plus their checked-in import test cases. Zotero documents RIS and BibTeX as standard import/export formats and documents translator test cases as input plus expected-result fixtures that are run automatically.

The evidence is pinned to `zotero/translators` commit `3d1c78530f42892328e08741b7cac8474ff687b8`. At that revision `RIS.js` has SHA-256 `1011694cf9459553ae019fe09c4bbb0b27ad57d739f22bd25cba0ca64d624554` and `BibTeX.js` has SHA-256 `2a99c1591f62ed3c52f85343ed6234d0318f458ab173efd2ef18549bd6ae7680`. The upstream translator files are AGPL-3.0-or-later. No upstream implementation code or full upstream fixture is copied here; `oracle-cross-check.json` contains synthetic minimal probes derived from independently maintained expected semantics and records the upstream test index for each claim.

Authoritative context is layered rather than pretending RIS has a current living specification. Zotero's data-format documentation identifies the official RIS specification as the Reference Manager specification last updated in 2001, and also documents the real-world divergences that importers must handle. Zotero independently implements bidirectional RIS import/export and BibTeX import/export, exposes current field mappings, and maintains expected-result translator tests. BibTeX syntax/type semantics remain grounded in the existing CTAN oracle already registered by this project.

## Mapping contract exercised by the oracle

| Direction | Source | Target | Expected semantics |
|---|---|---|---|
| RIS → BibTeX | `TY JOUR` / `EJOUR` | `@article` | article metadata |
| RIS → BibTeX | `TY BOOK` / `EBOOK` | `@book` | book metadata; `T2` is series context, not journal |
| RIS → BibTeX | `TY CHAP` / `ECHAP` | `@incollection` | book-section metadata |
| RIS → BibTeX | `TY CONF` / `CPAPER` | `@inproceedings` | conference-paper metadata |
| RIS → BibTeX | `TY THES` | `@phdthesis` | thesis metadata |
| RIS → BibTeX | `TY RPRT` | `@techreport` | report metadata |
| RIS → BibTeX | `A1` and `AU` | `author` | aliases compose into one ordered creator list; neither alias may erase the other |
| RIS → BibTeX | `DA`, deprecated `Y1` | `year` in the declared subset | `DA` wins when present; reducing a full date to a year is lossy and must be disclosed |
| BibTeX → RIS | `@article` | `TY JOUR` | title/author/journal/year/volume/issue/pages retain their meaning |
| BibTeX → RIS | `@inbook`, `@incollection` | `TY CHAP` | standard BibTeX book-section types remain book sections |
| BibTeX → RIS | unsupported fields | explicit loss report | fields outside the declared RIS subset remain listed in `unknownFields` and produce `BIBTEX_FIELD_UNMAPPED` |

The existing declared subset also maps DOI, URL, publisher, abstract, keywords, notes and pages. Fields or RIS tags outside that subset may be omitted only when the output reports the loss. The converter is not certified as a full Zotero/EndNote round-trip implementation.

## Known loss and ambiguity cases

- RIS carries many type-dependent fields that have no target in the current converter subset. These must be surfaced as unmapped rather than silently repurposed.
- A RIS full date such as `DA  - 1950/02/03` is currently reduced to a BibTeX `year`. That loses month/day precision and therefore requires a loss warning under the existing oracle invariant.
- BibTeX fields such as `urldate`, `howpublished`, identifier extensions, macros and implementation-specific metadata may have no RIS counterpart. The converter must list unsupported fields rather than silently drop them.
- BibTeX TeX markup and Unicode normalization are not claimed to round-trip semantically through RIS. Expanding that claim requires a separate oracle and fixtures.
- Multiple RIS aliases for the same semantic field require precedence/composition rules. `A1` plus `AU` compose in source order; deprecated `Y1` does not override `DA`.

## Defects discovered and closure evidence

Run `npx tsx quality/fixtures/research-ris-bibtex-conversion/verify-oracle.ts`. The verifier uses the production converter only as the system under test; expected values live in the pinned independent oracle corpus and RIS output is inspected by a small test-only parser rather than the production RIS parser.

The first run of the independent probes exposed real semantic mismatches: mixed `A1`/`AU` authors were overwritten instead of composed, deprecated `Y1` could override `DA` when tag order was reversed, `T2` on a `BOOK` was mislabeled as a journal instead of series context, full-date-to-year loss had no warning, and standard BibTeX `@inbook` degraded to `TY GEN` instead of `TY CHAP`. Ticket 276 fixes those behaviors in the RIS/BibTeX converter-specific compatibility layer; the shared research engine is unchanged. The independent oracle now passes all seven probes.

No Gold receipt may be created while any oracle probe fails. The seven probes now pass, `cand-187` binds the pinned Zotero cross-check at high confidence with no unresolved gap for this declared subset, and the research certifier issues `quality/receipts/research-knowledge/ris-bibtex-converter.gold.json` only after browser/locality/mobile/a11y, determinism and abort gates pass. Because promoting the oracle changes shared authority identities, every affected receipt was regenerated by its real family certifier; a repository-wide identity scan then reported zero stale oracle or fixture bindings. The physical Image Resize lane remained Partial throughout and was not promoted by this rebind.
