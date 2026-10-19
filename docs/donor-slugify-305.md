# STR #305 — slug-generator donor and rollback (19 Oct 2026)

Adopted for `src/tools/slug-generator/module.ts` only, which is loaded when the tool is run. Legacy `generateSlug` in `src/engines/text-writing/index.ts` remains the validation, script-preservation and rollback oracle.

| npm package | Version | npm SHA-512 integrity (package-lock.json) | License |
| --- | --- | --- | --- |
| [@sindresorhus/slugify](https://github.com/sindresorhus/slugify) | **3.0.1** | `sha512-N1oPvN6sytRKZCskv0L+vSyvnUYi9JplPXZ90lT6EBsijjHrUdoXttb0Lna6pw1TWMe8vlajQnLDtU9KYHqtDg==` | MIT |
| [@sindresorhus/transliterate](https://github.com/sindresorhus/transliterate) | 2.3.1 (locked transitively) | `sha512-gVaaGtKYMYAMmI8buULVH3A2TXVJ98QiwGwI7ddrWGuGidGC2uRt4FHs22+8iROJ0QTzju9CuMjlVsrvpqsdhA==` | MIT |
| [escape-string-regexp](https://github.com/sindresorhus/escape-string-regexp) | 5.0.0 (locked transitively) | `sha512-/veY75JbMK4j1yjvuUxuVsiS/hr/4iHs9FTT6cgTexxdE0Ly/glccBAkloH/DofkjRbZU3bnoj38mOmhkZ0lHw==` | MIT |

Upstream donor tag [`v3.0.1`](https://github.com/sindresorhus/slugify/releases/tag/v3.0.1), annotated tag object `36bc4c88997078251e0ffa9b0a353aa958c050fe`, target commit `2acf5b3cadf7faed3928536d051104502ae2b667`. npm package published 2026-09-01. The npm tarball integrity hashes are authoritative for installed bytes; no upstream source files were copied. All three packages have the **same** MIT copyright/license text, SHA-256 `5c932d88256b4ab958f64a856fa48e8bd1f55bc1d96b8149c65689e0c61789d3`; a copy is shipped as `/licenses/slugify-305-MIT.txt`. No extra runtime assets, fonts, models, network calls or copyleft transitive dependencies. The broader release provenance gate remains [#126](https://github.com/domenicomassafra/strumentini-it/issues/126).

## Behavior and environment

The adapter preserves the original `INVALID_INPUT` (including 2 MiB cap), `INVALID_SEPARATOR`, `INVALID_MAX_LENGTH`, booleans, abort-before-run, `text`/`slug`/`truncated`/`engineVersion` envelope, separators, optional lowercase, codepoint truncation, and on-device execution. NFKD accents and apostrophes keep their existing semantics. For non-Latin scripts (Han, Cyrillic, Greek, Arabic, Indic and mixed strings), the legacy Unicode output is retained to avoid erasing words or changing existing URLs. The donor improves residual Latin characters such as `ß→ss`, `æ→ae`, `œ→oe`, `ø→o` and `ł→l`. `decamelize:false` avoids changing previously unseparated camel case. This tiny local adapter is necessary because the donor by itself drops CJK (`你好 世界` → empty) and inserts new English words (`&` → `and`), which would violate the tested contract.

Browser target: modern Chromium, Firefox and WebKit using browser ESM, static Astro build and no server transformation. Chromium and Firefox were exercised locally on Mac Studio (Node 26.12.0); WebKit was exercised on MiniPC Linux (Node 24.18.0) through an SSH-forwarded local static server, using `STR305_ORIGIN=http://127.0.0.1:18157 STR305_BROWSER=webkit node test.mjs`. All three rendered and submitted three example inputs with no page errors, POSTs or external requests. Local Mac Studio WebKit could not create a Playwright page under concurrent host load, so that failure is not presented as a functional pass. No physical iOS/Android behavior is introduced; device emulation is not claimed as physical evidence. The module is loaded through the existing runtime's lazy tool implementation, so other text tools do not eagerly import the donor. CSP remains the existing self-hosted script policy.

## Measured cost and proof

Warm Node 24 benchmark, 5,000 iterations for each on `Café già detto & Straße Ærø coeur e-coöperate`, `maxLength:60`, `--expose-gc`, baseline vs donor sequentially, 25-call heap samples:

| Implementation | Total latency | Time/call | Sampled heap peak delta |
| --- | ---: | ---: | ---: |
| Legacy | 1,087.7 ms | 0.2175 ms | 4.02 MiB |
| Donor adapter | 2,222.0 ms | 0.4444 ms | 4.27 MiB |

The donor costs ~0.23 ms more per typical call (~2x latency), and ~0.25 MiB more sampled heap. The package/dependencies occupy ~112 KiB uncompressed in `node_modules`. The comparison is local Node instrumentation, not a browser device memory-profile receipt. The differentiated outputs and lower-level contract are tested in `tests/strume305-slugify.test.ts`; the actual tool page is exercised in three browsers by `node tests/strume305-slugify.browser.mjs` against a local `dist/` build. Static acceptance is `npm run acceptance:text-writing` (Chromium only) plus the new three-browser test.

Rollback: change the slug tool's `module.ts` back to importing `generateSlug` from `../../engines/text-writing` and remove its `donor` import; then remove the new package and dependency lock entries with `npm uninstall @sindresorhus/slugify`. The original engine remains intact. No production site deploy is part of this ticket.
