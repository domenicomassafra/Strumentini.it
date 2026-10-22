# #277 — Donor smol-toml (20 October 2026)

## Source and licensing

Upstream: https://github.com/squirrelchat/smol-toml (BSD-3-Clause).
Version: v1.9.1 released 2026-10-09, annotated tag object 19fb510266f994f6c2d28c9c6610cbf289e74227, peeled commit 69aa050fef018b71799519bb2cbb54f158a0c5f9; repository pushed as recently as 2026-10-10.
Npm archive: https://registry.npmjs.org/smol-toml/-/smol-toml-1.9.1.tgz
Tarball SHA-256: 4ac8392f1918c22a4366be19047cf53aa42646077d4c711b2ef73263beefb172
Recomputed SHA-512 integrity: sha512-j7WyPdf0CJoutMzMoPLF/bVXHtKZIT9Rb4eGeEbWw8X2t5oirjPgpL+OpaENZrILYaXqYwnVH+qgUwVbl+pUJQ==
This equals the npm package-lock integrity. The package includes BSD-3-Clause LICENSE, copied unchanged to public/licenses/smol-toml-277-BSD-3-Clause.txt for redistribution and notices. There are no declared direct or optional runtime dependencies and no new transitive runtime packages. The tarball includes JS/CJS, type declarations, README, package.json and LICENSE only: no WASM, fonts, media, models or remote assets. The broader source/license boundary remains tracked separately by #126/STR-366.

## Behavior and rollback

The client-side TOML formatter lazily imports the donor on invocation. The adapter retains the existing 1,000,000 character input limit, MAX_TOML_DEPTH=16, typed INVALID_TOML errors with diagnostics, cancellation before/after loading and prototype-safe record copies. Date instances are normalized for the JSON result while canonical TOML is emitted from the donor's original table. Unsafe integers are rejected by the donor instead of rounded. When the import chunk is unavailable, the bounded original parseToml/formatToml path remains usable with an explicit warning. Invalid TOML is never retried through the legacy parser. No external upload or Worker change.

Independent corpus tests/fixtures/toml-277/corpus.json checks Cargo/pyproject configs, dates, Unicode, nested arrays, repeated tables, key injection and invalid/boundary inputs. Full TOML constructs previously refused (multiline strings, nested tables, repeated arrays of tables) now parse and round-trip. Fixtures accepted by both engines compare values; date offset normalization is explicitly exempted from value-identity while round-trip remains mandatory. tests/toml-donor-fallback-277.test.ts injects a simulated missing import.

## Cost and validation boundaries

Warm Node 26.12.0 on MiniPC, 2,000 iterations on a 79-byte input, benchmark scripts/bench-toml-277.mts. This is one run with sequential implementations and sampled heap, not a device guarantee.

| Engine | Runtime total | ms/call | Sampled heap delta |
| --- | ---: | ---: | ---: |
| Original subset | 30.92 ms | 0.0155 | 4,285,776 bytes |
| smol-toml adapter | 29.64 ms | 0.0148 | 4,196,720 bytes |

Installed donor ESM entry index.js alone: 1,949 B / 992 B gzip excluding relative imports. Built donor chunk dist/_astro/dist.0mSzsNc8.js is 14,746 B raw / 5,593 B gzip on this build (asset name is content-hashed). In the real MiniPC automation-browser Chromium 390x844, strict self-only CSP and built static route, submitting multiline/date/repeated-table TOML produced a 91 B downloadable TOML, with 22 JS chunks requested pre-submit and 36 post-submit (actual lazy load), 46 same-origin requests, zero external requests, zero POST/upload, zero CSP violations and zero JS page errors. Physical Safari mobile is NOT_RUN. Worker handling is not applicable to this browser-local route. To roll back to the smaller legacy subset, restore the original call inside tomlFormatterOperation and remove the npm dependency; both legacy helpers are still present.
