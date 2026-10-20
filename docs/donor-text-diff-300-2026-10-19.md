# STR #300 — diff@9.0.0 adoption, benchmark and provenance (2026-10-19)

## Source and rights

- Donor: [kpdecker/jsdiff](https://github.com/kpdecker/jsdiff), npm package `diff` **9.0.0**, tag `v9.0.0` at Git commit `ed13aca03aa25735fafc0645d1185e7a1c68fd8c`; npm release **2026-04-13**. Independent owner reuse map: `reuse-str-testo.md`; upstream [issue #692](https://github.com/kpdecker/jsdiff/issues/692) addresses patch fuzz performance, not the `diffArrays` adapter.
- npm tarball: `https://registry.npmjs.org/diff/-/diff-9.0.0.tgz`; registry SHA-1 `297c31cd7c280f13dfe335791ec2063bd4a73a6f`; npm SHA-512 integrity `sha512-svtcdpS8CgJyqAjEQIXdb3OjhFVVYjzGAPO8WGCmRbrml64SPw/jJD4GoE98aR7r25A0XcgrK3F02yw9R/vhQw==`. Exact version and SRI pinned by `package.json` / `package-lock.json`.
- License **BSD-3-Clause**, copyright © 2009–2015 Kevin Decker. Complete upstream notice copied unchanged to [docs/licenses/diff-9.0.0-LICENSE](licenses/diff-9.0.0-LICENSE), SHA-256 `eda81a415869e67809f6a9f3fd6056062cb83a462118e07eec5e92b2e0c40ce9`. Retain this notice for redistributed binary bundles. No direct runtime transitive dependencies or bundled fonts/models/assets in `diff`; registry package/license checked with `npm view`, `npm ls` and local `LICENSE`.
- Browser/Worker ESM pure JS, no I/O or outbound requests. The existing registry lazily imports each tool implementation; `diffArrays` is imported within the deferred engine dependency. No new API, egress or CSP permission.

## Scope, behavior and rollback

The adapter operates on the same normalized newline-bearing line tokens as before, maps upstream change chunks back to one operation per line and retains the **1,000,000-cell input refusal** and tool's `INVALID_DIFF_TOO_LARGE` envelope. Cancellation remains checked by the tool runtime before execution. Because Myers performs badly with high edit distance, the donor is capped at **64 edits**; very low-overlap large inputs bypass it, and other over-cap inputs use the previous bounded LCS path. That fallback is retained intentionally to preserve preexisting valid inputs, tie behavior and bounded memory; it is isolated in `boundedLegacyDiff`.

Rollback: revert the adoption commit to restore the previous source and lockfile; no migration or persisted state is involved. The #126 cross-product license/asset provenance gate remains independent and **NO_GO** until its other unresolved evidence is cleared. This ticket does not authorize production deploy, claim Gold certification, or clear third-party release obligations.

## Validation recipe

```sh
npx vitest run tests/text-list-engine.test.ts tests/text-writing-engine.test.ts tests/text-diff-donor-300.test.ts --maxWorkers=1
for scenario in equal sparse distinct refusal; do
  for algorithm in legacy donor; do
    node --expose-gc --import tsx scripts/benchmark-text-diff-300.ts "$algorithm" "$scenario"
  done
done
npx astro build
node scripts/acceptance-text-diff-300.mjs
```

The independent LCS oracle in `text-diff-donor-300.test.ts` checks minimum edit count on 500 seeded repeated-token cases. Both reconstructed texts, Unicode, CRLF normalization, trailing newline, local refusal and abort are checked. A wider 5,000-pair pre-adoption differential found **644 alternate placements of equally short hunks** with repeated lines; the donor changes tie placement while preserving order, reconstructed content and minimal edit count. The two existing fixture sets are unchanged. No source-sensitive Gold receipt was rewritten.

Measurements must be read alongside their machine load: Node 24.18 on macOS, five rounds per case, separate processes per algorithm, `process.resourceUsage().maxRSS` (KB) for process-level high-water RSS; benchmarks are exploratory, not hard real-time performance guarantees. Inputs: equal/sparse 950 lines, distinct 650 lines, refusal 1001 lines. The preflight and bounded fallback were specifically added because **uncapped donor-only distinct** was ~407 ms median versus **~7.3 ms** for LCS before the guard. Avoid relying on uncapped Myers for unrelated large inputs.

Final bounded hybrid sample (2026-10-19; median of five sequential runs per case):

| Scenario | Legacy median | Hybrid median | Legacy peak process RSS | Hybrid peak process RSS |
| --- | ---: | ---: | ---: | ---: |
| 950 identical lines | 8.211 ms | 0.456 ms | 86,960 KB | 67,968 KB |
| 950 lines, 10 replacements | 9.336 ms | 0.573 ms | 72,384 KB | 68,176 KB |
| 650 entirely different lines | 5.500 ms | 5.932 ms | 71,392 KB | 70,512 KB |
| 1,001-line limit refusal | 0.079 ms | 0.072 ms | 67,584 KB | 67,472 KB |

The hybrid avoids the donor's worst-case delay for unrelated text while still speeding up the common mostly-equal case. RSS numbers cover the whole Node process and thus do not imply an exact library-only memory allocation. Baseline certification currently fails `npm run build` because `quality/receipts/expanded-catalog-certification.json` is stale; running `npx astro build` independently produces 304 local static pages, without changing that source-bound receipt.
