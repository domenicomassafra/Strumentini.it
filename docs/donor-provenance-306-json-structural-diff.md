# STR-306 — microdiff donor comparison (2026-10-19)

**Decision: NO_GO** for adoption of `microdiff@1.6.0`. The production
`jsonStructuralDiffOperation` in `src/engines/developer-web/structured-repair.ts`
remains the active implementation. This document records a tested donor
candidate, not a rights clearance, Gold certification or release permission.

## Candidate and provenance

| Property | Verified source/value |
| --- | --- |
| Upstream | https://github.com/AsyncBanana/microdiff |
| Source tag | [`v1.6.0`](https://github.com/AsyncBanana/microdiff/releases/tag/v1.6.0), commit `0949d1c556d45fda23f567f33f91cb838b88bfb2` |
| npm | `microdiff@1.6.0`, published 2026-08-02T22:24:45.019Z |
| Tarball | https://registry.npmjs.org/microdiff/-/microdiff-1.6.0.tgz |
| Registry/tarball integrity | `sha512-w7JWt8Bno6I8h0rEqlxr4lNG4UbT1FVtWo42wWosIiaJ+rP3pXh7shCYDnyqBrYx36LJ1CZ64p8A62aVp0sJpQ==` |
| Packed tarball SHA-256 | `dc245eb1740760557781bb1031aa923d81b0ae8c04073a0bc16e6f18c12aad4a` |
| License | MIT (npm manifest and included `LICENSE`, SHA-256 `d3b3705579c17e421cd1ae4bbc740798f288f894421c64f3bb157c87ff477235`) |
| Runtime dependencies | **None** declared; no transitive runtime notices/assets; upstream distribution includes bundled `dist/index.js` and `dist/index.cjs`. MIT license would need redistributable notice if adopted. |
| Target | Browser JavaScript, potential Cloudflare Worker; neither donor build nor Worker was shipped. |

Verified with `npm view microdiff@1.6.0`, `gh api repos/AsyncBanana/microdiff/git/ref/tags/v1.6.0`,
`npm pack microdiff@1.6.0`, `openssl dgst -sha512 -binary ... | openssl base64 -A`
and `shasum -a 256`. npm SRI matches independently hashed tarball bytes.
The project manifest and lockfile were **not** changed. The only donor install
was temporary and ignored, under `node_modules/str306-donor/` (32 KiB of
installed package). Parent #270 and rights/provenance gate #126 remain in force.

## Differential test and independent cases

Reproduce on the checkout after `npm ci`:

```sh
npm install --prefix node_modules/str306-donor --no-save --no-package-lock --ignore-scripts --no-audit --no-fund microdiff@1.6.0
node --expose-gc --import tsx src/tools/json-structural-diff/donor-comparison-306.mjs
```

The script compares 12 independent inputs. It parses JSON with the *existing*
strict parser on both sides, then applies the donor's raw diff with an elementary
type/path mapping (CREATE→add, REMOVE→remove, CHANGE→value/type, RFC 6901 path
escaping). These adjustments give the donor the most direct practical adapter
without rewriting comparison semantics. Observed: **8/12 cases diverge**.

| Case | Existing implementation | Mapped donor output |
| --- | --- | --- |
| Root `1` → `2`, `null` → `true` | `value`/`type` at `""` | No differences |
| `[1,2]` → `[2,1]` nested in object | One `order` at array pointer | Two `value` changes |
| Reordered array of objects | One `order` at array pointer | Per-element nested changes |
| `{}` → `{"toString":"present"}` | `add` at `/toString` | No difference |
| `{"constructor":"previous"}` → `{}` | `remove` at `/constructor` | `type` with right-side `function` |
| `{}` → `{"__proto__":{"flag":true}}` | `add` at `/__proto__` | No difference |
| `{"__proto__":{"flag":true}}` → `{}` | `remove` at `/__proto__` | Nested removal at `/__proto__/flag` |

The root cause is visible in `microdiff@1.6.0`'s source: comparison loops use
`for (const key in obj)` and membership `key in newObj`; inherited properties
of regular parsed JSON objects are mistaken for own keys. This can also allow
an inherited **function** into donor results, violating the JSON-only output
contract. The direct donor has no root primitive comparison and no array
reorder operation. Upstream [PR #58](https://github.com/AsyncBanana/microdiff/pull/58)
addresses other rich-object distinctions; it does not resolve these JSON
cases. These cases use valid JSON, with no prototypes or executable values
passed **as input**.

The existing parser rejects inputs beyond 1,000,000 characters or 128 nested
levels; the existing diff throws `JSON_DIFF_TOO_LARGE` above 20,000 differences.
For **20,002** changes, the donor emits 20,002 results while the local path
refuses. A replacement would require retaining the parser, adding result-size
guards, preserving duplicate-key warnings, cancellation and typed errors,
performing own-key traversal and array reorder detection, and repairing root
scalar comparisons. That is a second comparison implementation surrounding
the donor. The current implementation already provides these guarantees.

## Latency and memory (diagnostic, not a browser benchmark)

Both operations parsed the same 8,312-byte, 120-block fixture 250 times in
Node 24.18.0 (one warm-up, GC when exposed). The donor path includes parsing
and the basic adapter. The fixture changes nested scalar values and reorders
short arrays, where donor output is semantically weaker.

| Measurement | Local | Donor + parser + basic mapper |
| --- | ---: | ---: |
| 250 operations | 6,769.74 ms | 6,906.27 ms |
| Mean per operation | 27.08 ms | 27.63 ms |
| Sampled maximum `heapUsed` | 22.92 MiB | 25.15 MiB |
| Sampled maximum process RSS | 111.14 MiB | 98.61 MiB |

Heap/RSS measurements are coarse process samples at ten-iteration intervals
and include runtime/import state; they are neither isolated allocation
profiles nor exact peaks. A second verification on the same host produced
local/donor elapsed times of **707/617**, **399/396** and **369/388 ms** for
250 operations each, respectively. The sign of the timing difference changes
between runs and the donor still omits required differences; these figures
do not demonstrate a reliable end-to-end benefit for an equivalent operation.
The repeated donor sampled `heapUsed` maximum was **24.2–26.0 MiB**, versus
**14.9–15.4 MiB** locally. No actual bundle-size reduction or browser-memory
saving was established. The test-only npm package is about 32 KiB installed;
production bundle overhead is **not measured**, since adoption was rejected.

## Decision, rollback and acceptance boundary

**NO_GO**: eight semantic mismatches, inherited-property safety hazard, lost
bounded refusal without additional code, and no reliable measured improvement
for equivalent behavior. The **rollback is already in effect**: the existing
`jsonStructuralDiffOperation` is unchanged, with no package, import, lazy
adapter, feature flag or runtime egress introduced. Existing abort checks,
typed errors, duplicate-key caveats, CSP behavior and local-only processing
remain active. The browser/Worker target for a hypothetical new adapter was
not validated, since no adapter was shipped. Physical iOS/Android device
claims were not made. Site production deployment and Gold promotion are
separate gates, and #126 remains unresolved.

## Existing consumer verification

The unchanged source was compiled with `npm run build` (304 static pages,
`build inspection PASS`, no deployment) and served locally:

```sh
python3 -m http.server 43906 --bind 127.0.0.1 --directory dist
node src/tools/json-structural-diff/browser-smoke-306.mjs
```

Browser automation entered valid JSON into the *real rendered form*, submitted
the comparison, downloaded and parsed the completed local result, and checked
array reorder, inherited-name additions, and root primitive changes. **Chromium
and Firefox passed**, HTTP 200, no external network requests, zero page errors.
Headless Playwright WebKit did not complete `browser.newPage` (20-second timeout
in an isolated rerun); **WebKit is unverified**, not a pass or proven product
regression. No physical mobile or Worker acceptance is claimed. This remains
an unchanged local static consumer; no new distribution was installed.

`npx vitest run tests/developer-web-engine.test.ts tests/developer-structured-data.test.ts --maxWorkers=1`
passed 2 files / 33 tests, and `npm run tickets:test` passed 5 tests.
