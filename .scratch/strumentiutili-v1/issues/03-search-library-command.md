# 03 — Deterministic Search, Command Palette, and compact Library

**What to build:** Add metadata-only discovery over the currently available Gold catalog: global Search/Command, installed/recent-aware ranking, compact Library rows and facets, useful zero-result handling, and navigation-state preservation without eagerly importing tool code.

**Traces to:** US-04 / AC-04.1 / AC-04.2 / AC-04.3 / AC-04.4 / US-12 / AC-12.1 / AC-12.2 / DEC-01 / DEC-08

**Constraints:** C-02 / C-05 / C-08 / C-09 / C-13 / C-15 / C-19 / C-21 / C-22

**Blocked by:** 01 — Gold tracer: Business Day Calculator.

**Status:** complete

- [x] Catalog-derived search metadata covers names, aliases, verbs/jobs, category, optional pack/role tags, input types, runtime, and caller-supplied install/recent context without importing implementation chunks.
- [x] Cmd+K/Ctrl+K opens a semantic combobox/listbox palette with keyboard navigation, Enter to open, Esc to close, and focus restoration.
- [x] Ranking visibly separates Your Tools, Recent, and Library; exact installed matches precede task intent, recency, pack relevance, and general catalog matches.
- [x] Library renders dense rows and relevant facets rather than a decorative card wall and preserves filter/query/back-navigation state.
- [x] Zero-result state preserves the query, offers metadata-derived close intents when available, and exposes Request this tool without AI prose.
- [x] A generated 500-tool browser fixture proves the Library caps rendered rows at 50 and discovery does not trigger tool implementation chunk loads.
- [x] Mobile uses an explicit Search destination rather than depending on keyboard shortcuts.

**Verification:** Run search ranking fixtures, keyboard accessibility browser tests, a 500-item generated-catalog rendering/performance test, and production-network/chunk inspection proving search and Library do not fetch tool implementations before a tool is opened.

**Shared-gate note (2026-09-23):** Ticket 03 focused tests, production build, browser acceptance, chunk/network proof, diff-check, shared `astro check`, and the complete Ticket 01 verification chain all pass on shared `main`.
