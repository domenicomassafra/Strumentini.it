# STR-307 — XML formatter/validator donor decision (2026-10-19)

**Decision: `NO_GO` for adoption** of `fast-xml-parser@5.11.2`. The current local
`xmlOperation` path remains active. This is an independently reproducible
comparison and provenance record, **not** a rights approval, Gold acceptance,
donor installation in the product, or release permission.

## Scope and original contract

- Issue: https://github.com/domenicomassafra/strumentini-it/issues/307
- Existing XML validator/formatter/minifier: `src/engines/developer-web/structured-repair.ts`;
  route `src/tools/xml-formatter-validator/`.
- Related but separate [#291](https://github.com/domenicomassafra/strumentini-it/issues/291)
  concerns XML **table** mapping/CSV/XLSX. Its rowPath mapping, Office consumers,
  and the shared XML parser were not changed.
- [#126](https://github.com/domenicomassafra/strumentini-it/issues/126)
  remains `OPEN / NO_GO` for redistributable rights/notice/corresponding-source
  obligations. Its audit cannot be overridden by npm SPDX metadata or this probe.

## Candidate pinned at source and distribution

| Field | Verified value |
| --- | --- |
| Upstream | https://github.com/NaturalIntelligence/fast-xml-parser |
| Git tag | [`v5.11.2`](https://github.com/NaturalIntelligence/fast-xml-parser/releases/tag/v5.11.2), annotated tag object `2a4d8e8081fad1b5ddc108bd95a9075ec4827e3e` |
| Underlying Git commit | [`80e88a848b073fd630bc181291a24922c6d1e839`](https://github.com/NaturalIntelligence/fast-xml-parser/commit/80e88a848b073fd630bc181291a24922c6d1e839) |
| npm distribution | `fast-xml-parser@5.11.2`, released `2026-09-29T04:45:32.224Z` |
| npm tarball | https://registry.npmjs.org/fast-xml-parser/-/fast-xml-parser-5.11.2.tgz |
| Registry `dist.integrity` | `sha512-R9iDuNrQYeQut46cn2r2wHKn4HYzVDvDm5J1wW+koZewykv0yuO2HChTYeZtrULyHIDM9cj9TUXloCsueCQUog==` |
| Independent byte check | `npm pack fast-xml-parser@5.11.2`; `openssl dgst -sha512 -binary fast-xml-parser-5.11.2.tgz | openssl base64 -A` returned exactly the registry SRI; tarball 372,179 bytes |
| Declared license | MIT (npm and upstream LICENSE), not a clearance for the site |

For test only, the exact package was installed into ignored
`node_modules/str307-donor/` with `--no-save --no-package-lock --ignore-scripts`;
the root manifest and lockfile are unchanged. `npm` resolved eight packages,
all *declaring* MIT: `fast-xml-parser@5.11.2`, `strnum@2.5.1`,
`is-unsafe@2.0.2`, `xml-naming@0.3.0`, `fast-xml-builder@1.3.1`,
`@nodable/entities@3.1.0`, `path-expression-matcher@1.6.2`,
`anynum@1.0.1`. Seven contain an obvious `LICENSE` file in their installed
package directories; **`@nodable/entities@3.1.0` has no LICENSE/NOTICE file in
its package root** (registry SPDX alone is not independently verified
redistribution evidence). No notice assets or model/codec files were adopted;
distribution notices and the broader gate #126 still require clearance.
The installed test-only dependency tree occupied approximately **2,132 KiB**
on disk. This is neither a production bundle size nor a tree-shaken measurement.

## Differential and independent XML oracle

Reproduce after `npm ci`:

```sh
npm install --prefix node_modules/str307-donor --no-save --no-package-lock --ignore-scripts --no-audit --no-fund fast-xml-parser@5.11.2
node --expose-gc --import tsx src/tools/xml-formatter-validator/donor-comparison-307.mjs
```

The 21 cases comprise three existing XML corpus cases and an existing XXE
fixture (`quality/fixtures/developer-structured-data/vectors.json`), plus 17
independent fixtures (mixed SVG, PI/comments/CDATA, quoted attributes, DTD,
unknown entity, malformed XML, invalid XML 1.0 characters, `xml:space`,
namespaces, and resource limits). The candidate uses `XMLValidator.validate`
then `XMLParser` with `preserveOrder:true`, `processEntities:false`,
`ignoreAttributes:false`, no value coercion or trimming, and `XMLBuilder`
with `format:true`. This is the smallest plausible donor pipeline, not an
adapter with reimplemented security guards.

**Observed:** the candidate accepts nine documents rejected by the existing
subset: unknown entity, internal/external DTD, raw `]]>` character text,
numeric NUL, raw XML 1.0 control character, depth >64, nodes >50,000,
and input >1,000,000 characters. Its validator also says `true` for the
existing XXE fixture although its parser later refuses external entities;
validation alone is insufficient. Nine accepted inputs have different pretty
XML output, including mixed text with nested `<b>` or SVG `<tspan>`, inherited
`xml:space`, attribute quoting, namespaces, and PI/CDATA. `preserveOrder`
preserves the parsed event order but `XMLBuilder(format:true)` inserts actual
whitespace text around mixed content.

Independent oracles on the SVG fixture:

```text
Python xml.etree.ElementTree itertext(original): 'A B'
Python xml.etree.ElementTree itertext(donor-formatted): '\n  \n    A\n     \n    B\n  \n'
xmllint --nonet --noout original donor-formatted: exit 0 (both well-formed)
```

The discrepancy is semantic, even when the donor output remains well-formed.
The original local parser does not fully resolve XML namespace bindings either;
an unbound prefix passed both implementations in this probe. We do not claim
namespace compliance from these results or broaden the accepted subset.

## Latency, memory, footprint, and network considerations

Both probes processed the same 4,693-byte, 120-item input 300 times, on the
same host with Node 24.18.0, warmed once, timed using `performance.now()`;
the donor path includes validator, ordered parser, and pretty builder.
Measurements are environment-specific, not a browser performance guarantee.

| Measure | Existing local | Donor pipeline |
| --- | ---: | ---: |
| 300 operations | 79.03 ms | 170.60 ms |
| Mean / operation | 0.26 ms | 0.57 ms |
| Sampled maximum JS `heapUsed` (every 10 iterations) | 11.47 MiB | 15.13 MiB |
| Maximum process RSS (`/usr/bin/time -l`) | 86,228,992 bytes | 96,141,312 bytes |

Reproduce with `--bench-local` and `--bench-donor` arguments and
`/usr/bin/time -l`. OS RSS is a process high-water mark, including Node/tsx
runtime and imports; `heapUsed` is sampled and is not an exact V8 peak.
The measured candidate adds about 11.5% process RSS and 2.16x elapsed
time for this narrow workload. The candidate's test-only tarball is 372,179
bytes, with approximately 2.1 MiB installed dependency tree; **no production
bundle savings were measured**, since the donor was not integrated. Production
dependency/bundle overhead is therefore `NOT_RUN`.

The current route sends no XML upload and uses local `xmlOperation` without
runtime package or network fetch. The probe reads a local donor package and
local fixtures; it contains no HTTP fetch. An adopted adapter would still
require explicit no-egress, CSP, cancel/error-envelope, Cloudflare Worker,
browser Chromium/Firefox/WebKit, and where applicable physical mobile tests.
Those donor-specific acceptance runs are `NOT_RUN` for the rejected candidate.

The **existing compiled consumer** was built by `npm run build` (304 pages;
build inspection PASS) and served from `dist/` with
`python3 -m http.server 43907 --bind 127.0.0.1 --directory dist`.
The browser test in `src/tools/xml-formatter-validator/browser-smoke-307.mjs`
opened `/tools/xml-formatter-validator/` in headless Playwright Chromium,
Firefox and WebKit, entered mixed content, ran the UI, downloaded the local XML
and byte-compared it with `<p>Hello <b>world</b> !</p>`, then entered XXE and
checked the actual UI refusal. Each browser reported HTTP `200`,
`mixedContent:PRESERVED`, `xxe:REJECTED`, `download:EXACT_XML`,
`egressRequests:0`, and `pageErrors:0`. The test intercepts non-loopback
requests and aborts them. This proves the unchanged compiled consumer on
desktop engines; it does not prove an adopted donor or physical iOS/Android.
Reproduce with `node src/tools/xml-formatter-validator/browser-smoke-307.mjs`
while the static server is running. The static preview returned `404` for
optional `/api/auth/session` because it has no API Worker; the XML route
completed without that endpoint.

## Decision and rollback

### Verification performed

| Command / exercise | Observed result |
| --- | --- |
| `npx vitest run tests/developer-web-engine.test.ts tests/developer-structured-data.test.ts tests/svg-donor-svgo-059.test.ts --maxWorkers=1` | 3 test files passed; 45 tests passed |
| `npm run tickets:test` | 5 tests passed |
| `npm run check` | EXIT 0; Astro check 2,218 files, 0 errors, 0 warnings, 35 deprecation hints in unrelated files |
| `npm run build` | EXIT 0; 304 pages, build inspection PASS; generated route served from `dist/` |
| `npm run deploy:check` | EXIT 0; portable static check PASS, Cloudflare Wrangler `--dry-run` exits without publishing |
| `npm ci --prefix spikes/heavy-local-feasibility --omit=dev --ignore-scripts` | Installed optional Office/OCR test prerequisites in spike prefix |
| `npx --yes --package=node@26 -c 'node --version && npm test -- --maxWorkers=1'` | Node 26.12.0; **400/400 test files PASS**, **2,800 tests passed, 9 skipped** |
| Compiled route in Chromium/Firefox/WebKit (Playwright) | Local XML text preserved, XXE rejected, saved XML downloaded byte-for-byte, no nonlocal requests, zero page errors |

The first full run under Node 24.18.0 with the optional spike dependencies
absent failed unrelated Office/OCR/PDF tests (7 test files, 14 tests). Those
failures were eliminated by installing the repository's declared spike
dependencies and running the suite on its required Node 26.12.0; the full
result above is green. No test assertions or product paths were modified to
obtain that result.

`NO_GO`: nine lost refusals, mixed-content corruption, observed overhead,
unverified complete runtime notices, and the open #126 rights gate.
Preserving the existing validator/formatter is the approved parity fallback;
no `import()`/lazy adapter, feature flag, new dependency, or network path is
published. The rollback path is already active: `xmlOperation` remains
unchanged and no migration or state conversion took place. A future adoption
would need to prove equivalent bounded refusals and correct XML mixed-content
serialization, pin exact transitive bytes/notices, obtain #126 clearance,
and rerun browser/mobile/Worker tests before release.

No Gold, public deployment, or closure of #126 is implied by these results.
