# 59 — JSON/XML/CSS/HTML/SVG minimizer pack

**What to build:** Add safe deterministic minify/prettify jobs for JSON, XML, CSS and HTML, integrate SVG optimization from ticket 47, and upgrade existing JSON/YAML/TOML formatters with size-delta and copy/download modes.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-07

**Constraints:** Parser-backed transforms only; HTML preserves whitespace-sensitive contexts; CSS/XML must validate before/minify; regex JavaScript minification is explicitly refused.

**Blocked by:** 168, 191, 192, 193, 209.

**Status:** ready-for-agent

- [x] JSON/XML/CSS/HTML show input/output bytes and saved percentage where minification reduces size.
- [x] Prettify and minify are two explicit modes with stable output for JSON/XML/CSS/HTML (CSS AST formatting and bounded HTML structural indentation; HTML whitespace limitations disclosed).
- [x] Invalid JSON/XML/CSS/HTML input reports parser-backed source location where available and never emits a misleading “optimized” file (diagnostic regressions in parser-specific tests; no output artifact on errors).

**Verification:** Parser round-trip fixtures, whitespace-sensitive HTML/CSS cases, malformed input tests and size-delta acceptance.

**Progress (2026-10-08):** `src/runtime/developer-transform-download.ts` selects only successful parser-approved JSON/XML/CSS/HTML transformed strings. `DeveloperWebTool` copies exact transformed content and downloads `.json`/`.xml`/`.css`/`.html` with matching MIME (not a JSON summary). Input/output/savings rows are recalculated from actual UTF-8 content. `tests/developer-transform-download.test.ts` covers these formats and fail-closed validate-only/error states. `scripts/acceptance-developer-transform-download.mjs` exercises real downloads in Chromium, Firefox and WebKit: **12/12 PASS**, Unicode and byte sizes verified, no offsite task traffic, 390 px layout. Full test suite **1102/1102** PASS, Astro **0 errors**, static build **279 pages**. CSS/HTML readable prettify remains outstanding; SVG optimization remains refused by tickets 209/268 until a vetted optimizer passes security/corpus gates. Ticket 59 remains open.

**Further implementation (2026-10-08):** CSS uses the *existing validated css-tree AST* to produce readable, deterministic rule/declaration indentation without regex rewriting string or custom property values. HTML has a separate `prettify` mode that indents only block-only containers via parse5 node trees; it does not insert whitespace into inline/mixed or pre/textarea/script/style content and explicitly warns that whitespace-only DOM nodes/CSS whitespace-dependent behavior can change. Both modes are exposed in the local UI and export the actual formatted source, not metadata JSON. `tests/developer-minifiers.test.ts` covers stable second-pass output, CSS minify round-trip, sensitive HTML and malformed mode. `scripts/acceptance-developer-transform-download.mjs` adds two readable-mode cases in all three browser engines. Ticket remains **OPEN**: SVG optimization remains REFUSED pending independent security acceptance; no fictional vector optimizer or fresh Gold claim.
