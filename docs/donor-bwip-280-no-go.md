# #280 — bwip-js 4.11.4 comparative decision (20 October 2026)

**Decision: NO_GO for the current EAN-13 / strict Code128B consumer.** The existing barcode-linear-v1 engine remains the production path. This comparison does not change package.json, package-lock.json, the browser route, the encoder or the donor register of distributed dependencies. No production deploy or Gold promotion follows.

## Candidate and distribution rights

- Upstream: [metafloor/bwip-js](https://github.com/metafloor/bwip-js), tag [v4.11.4](https://github.com/metafloor/bwip-js/releases/tag/v4.11.4) published 2026-08-19, Git commit 4dcf6129ba4bcd7de760e7bd4e400bca11473ccf. Package npm bwip-js@4.11.4, archive https://registry.npmjs.org/bwip-js/-/bwip-js-4.11.4.tgz.
- The trial package-lock.json pins integrity sha512-FOXnOQkinxog8FwxdnPB+8k2wRqwPnqXwxX37KcXOtMNW+9CinOkGv9MtIoRC4HX/UyogT0/9lIp6FDm2DcquQ==. The installed npm package contains the MIT LICENSE for Mark Warren (SHA-256 cc393d55aa77ec8e5aa27065244596b5ed8b2c6a1bc5c014045e11f91f343492); its lockfile entry lists no new runtime transitive dependencies or WASM/assets. GitHub's repository-wide license API returns NOASSERTION, so the npm tarball's actual license is the relevant checked grant for the trial.
- No donor asset is redistributed by this decision. If reconsidered, include the complete MIT text, recheck tarball integrity and provenance, and satisfy the then-applicable #126 distribution checks.

## Experiment and observed behavior

The existing MiniPC worktree at ~/Code/.worktrees/strumentini-it-280 contains a local, unpublished experiment using a lazy bwip-js import and raw() for EAN-13 and Code128 widths. Its caller computes the *entire* existing local result first, and attributes the donor only when its bits are identical. Code128 automatic Code Set A/C optimization differs from the product's strict Code Set B contract on digit-heavy inputs; the experiment falls back to the local encoding. The UI still renders local SVG. This duplicates encoder work without added capability or reduced output bytes.

On MiniPC Node **26.12.0**, the experiment passed npx vitest run tests/barcode-generator.test.ts --maxWorkers=1: **1 file, 12/12 tests PASS**, covering a 28-vector EAN-13 and Code128B corpus, local/donor bit comparisons, independent SVG reconstruction, and refusal/cancellation. These tests prove the trial behavior, not production admission. git diff --check was clean. Current main/browser behavior is unchanged.

Warm throughput comparison on the same experiment with 14 EAN-13 and 14 Code128B vectors, 60 iterations (1,680 operations per pass), sequential native calls versus awaited donor calls in one Node process:

| Run | Existing local | Trial donor path |
| --- | ---: | ---: |
| First pass (startup and host I/O load) | 1,184 ms | 1,503 ms |
| Warm pass 2 | 67 ms | 651 ms |
| Warm pass 3 | 68 ms | 561 ms |

The donor adapter is **8.25–9.72× slower** in warm passes (561/68, 651/67) while producing the same module/SVG contract. Sampled process heap after the passes was 27,771,520 bytes, **not** a peak or donor delta. The MiniPC was heavily loaded; these are Node timings, not Safari/mobile measurements. CPU/peak memory in browsers, CSP, Safari mobile and actual Web Worker consumer parity remain **not measured**. A future adoption must pass those gates; a slower redundant encoder need not be shipped to demonstrate this NO_GO.

## Rollback and reconsideration

Rollback is already effective: main retains its deterministic local engine, browser route and zero-upload contract, with no added dependency. Preserve the unpublished experiment and corpus privately as the old worktree is retired; it is neither merged nor claimed as shipped. Reconsider only a true replacement that avoids double encoding, preserves strict Code128B/EAN refusals, measures an independent benefit with real-browser decode, and satisfies provenance/asset review. #126 remains a separate global redistribution question.
