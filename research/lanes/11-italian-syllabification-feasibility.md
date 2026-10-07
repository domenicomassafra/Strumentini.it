# Lane 11 — Italian syllabification feasibility

**Date:** 2026-10-06  
**Ticket:** expansion #309  
**Decision:** **REFUSE** for an authoritative "divisione in sillabe" feature

## Why this is refused

Italian orthographic syllabification has a documented rule set, but the sources themselves describe places where spelling, pronunciation and line-break convention diverge, plus optional divisions for compounds and learned/foreign-looking consonant clusters. A generic rule engine therefore needs lexical or phonological knowledge for some cases; presenting one heuristic split as the authoritative syllabification would overstate certainty.

The strongest practical browser/JavaScript candidate found is `hyphen@1.14.1` with its Italian entry point. The package is ISC-licensed and exposes TeX-style hyphenation patterns. The underlying Italian `hyph-it` patterns are published through `hyph-utf8`; the Italian licence file identifies Claudio Beccari's patterns, version 4.9 (2014-04-22), as LPPL-1.3-or-later **or** MIT and says they are intended to comply with UNI 6461. That is useful evidence for typographic hyphenation, but it is still a hyphenation system rather than a complete linguistic syllabifier.

This distinction is observable. In a fresh temporary install of `hyphen@1.14.1`, the Italian hyphenator omitted valid syllable boundaries documented by Treccani:

| Word | Treccani division | `hyphen/it` observed | Result |
|---|---|---|---|
| `amido` | `a-mi-do` | `ami-do` | misses initial syllable boundary |
| `mia` | `mi-a` | `mia` | misses hiatus boundary |
| `leone` | `le-o-ne` | `leo-ne` | misses hiatus boundary |
| `aiuola` | `a-iuo-la` | `aiuo-la` | misses initial boundary |
| `nessun'amica` | `nes-su-n'a-mi-ca` | `nes-sun'a-mi-ca` | different apostrophe/consonant split |

Those are expected for a line-breaking hyphenator with left/right minima; they are disqualifying for a product that promises every syllable boundary.

## Source and licence review

1. Treccani, *La grammatica italiana*, “SILLABE, DIVISIONE IN” (2012): <https://www.treccani.it/enciclopedia/divisione-in-sillabe_%28La-grammatica-italiana%29/>. It documents hiatus/diphthong/triphthong behavior, apostrophes, diacritic groups, consonant clusters, doubled consonants/`cq`, foreign-looking clusters such as `feldspato`/`tungsteno`, and optional etymological splitting for some compounds.
2. Treccani, *Enciclopedia dell'Italiano*, “sillabe, divisione in [prontuario]” (2011): <https://www.treccani.it/enciclopedia/divisione-in-prontuario-sillabe_%28Enciclopedia-dell%27Italiano%29/>. It explicitly distinguishes phonetic structure from conventional written division and discusses exceptional clusters.
3. CTAN `hyph-utf8`: <https://ctan.org/pkg/hyph-utf8>. Current collection metadata describes it as TeX hyphenation patterns, versioned by release date, with package-level MIT licensing subject to per-language exceptions.
4. Italian pattern licence mirror: <https://android.googlesource.com/platform/external/hyphenation-patterns/+/refs/tags/android-platform-14.0.0_r9/it/hyph-it.lic.txt>. It records Italian pattern version 4.9, dual LPPL-1.3-or-later/MIT terms, and the UNI 6461 compliance intent.
5. `hyphen@1.14.1`: <https://www.npmjs.com/package/hyphen>. Repository metadata reports ISC for the engine package; the package exposes `hyphen/it` as an Italian hyphenation entry point.

## Ambiguity boundary

The feature may be reconsidered only if its claim is narrowed or its oracle improves. A truthful implementation path would need one of:

- a syllabification-specific maintained lexical/phonological source with redistribution terms and coverage for stress-sensitive hiatus/diphthong distinctions, compounds, apostrophes, learned clusters and foreign words; or
- a product explicitly named and described as **typographic hyphenation / line-break opportunities**, where TeX patterns are the intended semantics and omitted syllable boundaries are not presented as errors.

Until then, ticket 309 remains a feasibility-only refusal. No production route or heuristic syllabifier should be added from this evidence.

## Reproduction

The held-out corpus is `quality/fixtures/italian-syllabification/corpus.json`. Candidate observations were produced from an isolated temporary install, leaving the application dependency graph unchanged:

```bash
npm install --prefix "$TMPDIR/<temp>" --ignore-scripts --no-package-lock --no-save hyphen@1.14.1
```

The corpus intentionally contains source-backed matches, source-backed mismatches and foreign-word ambiguity cases. A feasibility test checks that all required ambiguity classes stay represented.
