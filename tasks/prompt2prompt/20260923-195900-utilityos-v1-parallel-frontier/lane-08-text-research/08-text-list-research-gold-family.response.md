Status: COMPLETE
Continuation: NONE
Stop-Reason: COMPLETE
Attempt: 1
Response-Covers-Through: aa940e7ba32760ade51ab24d5b51a5c25fe3ba47
Updated-At: 2026-09-23T21:10:16+02:00
Prompt: /Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-195900-utilityos-v1-parallel-frontier/lane-08-text-research/08-text-list-research-gold-family.prompt.md
Lane: lane-08-text-research

## Result

Ticket 08 is complete on shared `main` in commit
`aa940e7ba32760ade51ab24d5b51a5c25fe3ba47` (`feat: ship text and research gold tools`).

Shipped three independently discoverable/openable LOCAL Gold tools:

1. List Compare & Dedupe;
2. Text Diff;
3. DOI / ISBN Normalizer.

The implementation promotes the dependency-free core-engine behavior into two
small deep production modules: `text-list` and `research-reference`. It does
not add package dependencies, remote metadata lookup, semantic citation repair,
or hidden network execution.

## Changes

- Added `src/engines/text-list/index.ts` with:
  - explicit `exact`, `trim`, `nfc`, and `trim-nfc` equality modes;
  - deterministic first-seen dedupe/intersection/difference;
  - CRLF/CR-to-LF list parsing semantics;
  - line-based diff with the original 1,000,000-cell LCS safety guard intact.
- Added `src/engines/research-reference/index.ts` with:
  - conservative DOI presentation normalization and deterministic DOI-shape validation;
  - DOI resolver URL construction without resolution/fetching;
  - ISBN-10/13 presentation normalization, check-digit validation, 978/979 ISBN-13 prefix validation, and valid ISBN-10 to ISBN-13 conversion.
- Added three tool modules, types, and canonical manifests under
  `src/tools/{list-compare,text-diff,doi-isbn-normalizer}/`.
- Added three user-facing Preact/Astro surfaces with explicit methodology copy.
  Text Diff uses visible `=`, `−`, `+` symbols plus `Unchanged`, `Removed`, and
  `Added` labels, so meaning is not color-only.
- Added public-seam tests:
  - `tests/text-list-engine.test.ts`;
  - `tests/text-list-catalog.test.ts`;
  - `tests/research-reference-engine.test.ts`.
- Added lane Gold certification and bundle-reuse proof:
  - `scripts/gold/text-research.ts`;
  - `scripts/gold/text-research-bundle.ts`.
- Added browser acceptance:
  `scripts/acceptance-text-research.mjs`.
- Added five lane receipts under `quality/receipts/text-research/`.
- Closed `.scratch/utilityos-v1/issues/08-text-list-research-gold-family.md`
  with executable closure evidence.
- No package/spec file was edited.

## Verification

TDD / public seams:

- Initial targeted RED was observed: both new suites failed because
  `src/engines/text-list` and `src/engines/research-reference` did not yet exist.
- Final targeted Ticket 08 suite: **16/16 PASS** across 3 test files.
- Final repository suite: `npm test` — **64/64 PASS**, 15 test files.

Static/build/catalog:

- `npm run check` — PASS, **0 errors / 0 warnings / 0 hints**.
- `npx astro build` — PASS, 8 static pages built including all three Ticket 08 routes.
- `npm run catalog:check` — PASS; 6 current manifests, with Ticket 08 tools independently identified and routed.
- Scoped `git diff --cached --check` — PASS before commit.
- Source scan of Ticket 08 engines/tools/components/Gold scripts found no `fetch`,
  `XMLHttpRequest`, `WebSocket`, or `EventSource` use.

Gold:

- `npx tsx scripts/gold/text-research.ts` — PASS:
  - `list-compare`: 2 independent exact list vectors plus Unicode/line-ending and algebraic properties;
  - `text-diff`: 2 independent exact diff vectors plus reconstruction, CRLF/LF equivalence, and 1,000,000-cell guard;
  - `doi-isbn-normalizer`: 7 independent DOI/ISBN vectors plus DOI idempotence, ISBN check digits, and ISBN-10→13 conversion.
- All three manifests declare `runtime.location=LOCAL` and `network=forbidden`.

Browser acceptance:

- `node scripts/acceptance-text-research.mjs` — PASS for all 3 tools.
- Keyboard submit flows exercised with Enter.
- 390×844 mobile viewport has no horizontal overflow.
- Text Diff addition/removal semantics verified as visible symbol + text, not color-only.
- Zero external requests and zero task-content-bearing requests after task start.

Bundle/deep-module reuse:

- `npx tsx scripts/gold/text-research-bundle.ts` — PASS.
- Final build proof: dynamic List Compare module `module.CK53PA3s.js` and Text Diff
  module `module.DmvG6L3E.js` both import the same lazy shared engine chunk
  `text-list.CgzEIe9u.js`.
- The shared chunk contains the equality primitives, `DIFF_TOO_LARGE` guard,
  and `text-list-v1` engine identity and is not eagerly referenced by any of the
  three Ticket 08 route HTML files.

Regression / Ticket 01:

- `npm run verify:ticket-01` — complete PASS:
  - 64/64 tests;
  - typecheck;
  - build + build inspection;
  - catalog check;
  - Business Day Gold;
  - Gold sabotage fail-closed checks;
  - Business Day browser acceptance;
  - Wrangler dry-run deploy check.

## Conflicts or blockers

No Ticket 08 blocker remains.

Concurrent work from other lanes was present throughout the implementation and
was preserved. Before the Ticket 08 commit, the Git index already contained
staged work from other lanes. The lane was committed with an explicit
path-scoped `git commit --only`, so those staged changes were not included.
Immediately after commit, all Ticket 08 owned paths were clean while unrelated
Ticket 02/workbench changes remained staged/modified exactly outside this lane.

Five optional read-only worker attempts across design/Gold/edge-case/review
passes failed to report back in the host app. No worker output was used. The
prime completed the spec/standards review directly and the executable gates
above provide the final acceptance evidence.

## Residual work

No residual work is required for Ticket 08.

Deliberate bounded behavior remains explicit rather than hidden:

- Text Diff rejects matrices above 1,000,000 LCS cells; no unbounded fallback is silently substituted.
- DOI validation proves only the documented local syntax shape, not registration or bibliographic truth.
- ISBN handling validates identifier syntax/check digits and deterministic conversion only; it does not infer books, editions, authors, or titles.
- List comparison does not case-fold, locale-sort, fuzzy-match, or semantically repair input.

## Integration notes

- The canonical manifests are discovered by the existing catalog generator; no
  manual generated-catalog edit is required.
- `list-compare` and `text-diff` intentionally remain separate searchable tool
  identities while sharing the same deep `text-list` production engine.
- The DOI/ISBN tool shares one `research-reference` module because both
  operations are deterministic identifier normalization/validation, while the
  user selects the identifier type explicitly.
- Methodology copy on each route is the contract for normalization semantics;
  expanding those claims requires new independent fixtures/oracle evidence.
- Commit: `aa940e7ba32760ade51ab24d5b51a5c25fe3ba47`.

## Next exact action

No further action is required in lane 08. The owner/integration lane can consume
commit `aa940e7ba32760ade51ab24d5b51a5c25fe3ba47` and continue the remaining
UtilityOS v1 frontier lanes without reopening Ticket 08.
