# 59 — JSON/XML/CSS/HTML/SVG minimizer pack

**What to build:** Add safe deterministic minify/prettify jobs for JSON, XML, CSS and HTML, integrate SVG optimization from ticket 47, and upgrade existing JSON/YAML/TOML formatters with size-delta and copy/download modes.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-07

**Constraints:** Parser-backed transforms only; HTML preserves whitespace-sensitive contexts; CSS/XML must validate before/minify; regex JavaScript minification is explicitly refused.

**Blocked by:** 168, 191, 192, 193, 209.

**Status:** blocked (raw formatted-file copy/download and UTF-8 byte-delta implemented; CSS/HTML prettify and SVG optimizer still absent)

- [x] JSON/XML/CSS/HTML show input/output bytes and saved percentage where minification reduces size.
- [ ] Prettify and minify are two explicit modes with stable output.
- [ ] Invalid input reports source location and never emits a misleading “optimized” file.

**Verification:** Parser round-trip fixtures, whitespace-sensitive HTML/CSS cases, malformed input tests and size-delta acceptance.

**Progress (2026-10-08):** `src/runtime/developer-transform-download.ts` selects only successful parser-approved JSON/XML/CSS/HTML transformed strings. `DeveloperWebTool` copies exact transformed content and downloads `.json`/`.xml`/`.css`/`.html` with matching MIME (not a JSON summary). Input/output/savings rows are recalculated from actual UTF-8 content. `tests/developer-transform-download.test.ts` covers these formats and fail-closed validate-only/error states. `scripts/acceptance-developer-transform-download.mjs` exercises real downloads in Chromium, Firefox and WebKit: **12/12 PASS**, Unicode and byte sizes verified, no offsite task traffic, 390 px layout. Full test suite **1102/1102** PASS, Astro **0 errors**, static build **279 pages**. CSS/HTML readable prettify remains outstanding; SVG optimization remains refused by tickets 209/268 until a vetted optimizer passes security/corpus gates. Ticket 59 remains open.
