# 59 — JSON/XML/CSS/HTML/SVG minimizer pack

**What to build:** Add safe deterministic minify/prettify jobs for JSON, XML, CSS and HTML, integrate SVG optimization from ticket 47, and upgrade existing JSON/YAML/TOML formatters with size-delta and copy/download modes.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-07

**Constraints:** Parser-backed transforms only; HTML preserves whitespace-sensitive contexts; CSS/XML must validate before/minify; regex JavaScript minification is explicitly refused.

**Blocked by:** 168, 191, 192, 193, 209.

**Status:** blocked

- [ ] JSON/XML/CSS/HTML show input/output bytes and saved percentage where minification reduces size.
- [ ] Prettify and minify are two explicit modes with stable output.
- [ ] Invalid input reports source location and never emits a misleading “optimized” file.

**Verification:** Parser round-trip fixtures, whitespace-sensitive HTML/CSS cases, malformed input tests and size-delta acceptance.
