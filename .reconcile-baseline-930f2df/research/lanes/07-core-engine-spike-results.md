# Lane 07 — deterministic core-engine spike results

Status: implementation spike complete. This is evidence for later product
integration, not authorization to wire these modules into the app shell.

## Result

Ten dependency-free/native-first engine families now have isolated TypeScript
implementations under `spikes/core-engines/`, each exercised through a narrow
public seam. The spike does not edit root build/package files and does not
select Astro, Preact, or any other UI framework.

The implementation follows the architecture's deep-module direction: named
domain operations rather than a universal transform DSL, deterministic local
execution, Web Platform APIs first, and no server/network path.

## Engine disposition

| Family                   | Working seam                                                                          | Promote                                                                         | Do not promote unchanged                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Text normalization/stats | `inspectText`, `normalizeWhitespace`, `findInvisibleCharacters`                       | counts, whitespace policy, invisible-character inspection                       | do not market code-point count as grapheme count; keep semantics explicit                                               |
| List/set/diff            | `sortLines`, `dedupeLines`, `compareLists`, `diffText`                                | sort/dedupe/set operations; small-text diff                                     | LCS matrix is intentionally capped at 1,000,000 cells; use a different algorithm/worker for large diffs                 |
| URL/query                | `parseUrl`, `normalizeUrl`, `cleanTrackingUrl`                                        | WHATWG URL parsing, stable query normalization, conservative tracker removal    | do not broaden tracker removal without fixtures/policy                                                                  |
| UTM                      | `buildUtmUrl`, `parseUtmUrl`                                                          | canonical UTM build/parse primitives                                            | no campaign analytics/network behavior belongs here                                                                     |
| Date/duration            | `addCalendarDays`, `differenceInCalendarDays`, `addBusinessDays`, duration converters | UTC calendar arithmetic, Mon-Fri business-day baseline, decimal-hour conversion | holiday-aware calendars and timezone scheduling require separate data/Intl-focused work                                 |
| Business math            | `convertRate`, `marginMarkup`, `projectProfitability`, `grossUpForFee`                | deterministic formulas with explicit work-basis/rounding metadata               | product wording, currency display, tax/regulatory formulas must not be inferred from these generic primitives           |
| Encoding/hash            | Base64 byte/UTF-8 helpers, `digestHex`, `verifyDigestHex`                             | Base64 and in-memory SHA-2 using native Web APIs                                | large-file incremental hashing; `SubtleCrypto.digest` is not streaming                                                  |
| Filename/rename plan     | `sanitizeFilename`, `planSanitizedRenames`                                            | pure sanitization and deterministic collision planning                          | actual rename I/O and filesystem-specific byte-limit guarantees belong in adapters                                      |
| JSON                     | `validateJson`, `formatJson`                                                          | native JSON syntax validation/formatting                                        | schema validation, YAML conversion, or untrusted schema semantics                                                       |
| Profile defaults         | `resolveDefaults`                                                                     | requested-field filtering, precedence, provenance, sensitive-field suppression  | production integration should bind to the canonical heterogeneous Work Profile schema rather than invent another schema |

CSV, YAML, PDF, image codecs, QR encoding, and large-file hashing were
intentionally not implemented here because the lane explicitly reserves those
for focused dependency/parser/codec spikes.

## Test and correctness evidence

The final suite contains 38 tests across 10 engine-family test files.

Coverage includes:

- literal Unicode/code-point/UTF-8 fixtures;
- normalization and cleaning idempotence;
- composed/decomposed Unicode deduplication;
- repeated URL parameters and invalid URL input;
- UTM overwrite/preserve behavior and Unicode round-trip;
- leap day, year boundary, weekend skipping, negative business-day offsets, and
  invalid date/duration input;
- zero denominators, distinct margin/markup formulas, explicit rate basis,
  project profitability, fee gross-up, and invalid fee/project basis;
- RFC-style Base64 vectors, binary bytes, malformed Base64, invalid UTF-8, and
  the published SHA-256 `abc` vector;
- Windows-reserved filename stems, forbidden/control/format characters, Unicode
  filenames, empty input, and case-insensitive collision planning;
- valid/invalid JSON plus semantic round-trip;
- profile precedence, requested-field-only behavior, duplicate requests,
  sensitive suppression, and empty requested fields;
- LCS diff known answer plus a deterministic memory guard.

### Red-before-green evidence

Before source implementation existed, `deno test tests` was observed red with
ten `TS2307` missing-module errors, one for every engine-family test seam.

### Sabotage evidence

Three nontrivial behaviors were deliberately broken and the targeted tests were
observed failing:

1. tracking cleanup: removing the `utm_` rule caused the URL test to retain
   `utm_source` and `utm_medium`; result was 2 passed / 1 failed;
2. fee gross-up: replacing division by `1 - feeRate` with multiplication by
   `1 + feeRate` produced gross `99.91` / fee `2.91` instead of `100` / `3`;
   result was 3 passed / 1 failed;
3. profile precedence: resolving the profile source as explicit broke
   explicit-over-profile precedence and sensitive-field behavior; result was 0
   passed / 3 failed.

The first sabotage harness used shell `EXIT` traps inside one shared command
session; two traps were overwritten by later traps, so the tracking and fee
mutations remained active until the subsequent full-suite run caught them. They
were then explicitly restored. A final full verification after restoration is
green; this incident itself demonstrates the suite catches those mutations.

## Final verification receipt

Observed on Darwin 25.6.0 arm64:

- Node: `v26.6.0`;
- Bun: `1.3.14`;
- Deno: `2.9.6` (`aarch64-apple-darwin`);
- Deno V8: `15.0.245.2-rusty`;
- TypeScript used by Deno: `6.0.3`.

Final commands:

- `deno task check` — PASS;
- `deno task test` — PASS, **38 passed / 0 failed**;
- `deno fmt --check` — PASS;
- `deno lint` — PASS.

Dependency inventory:

- third-party runtime dependencies: **0**;
- third-party test dependencies: **0**;
- test-only compatibility import: Deno-provided `node:assert/strict`;
- source network calls: **0**;
- source server code: **0**;
- frontend framework imports: **0**.

## Bundle-neutrality assumptions

Every source file is a side-effect-free ES module apart from immutable module
constants. Consumers can import individual engine files instead of the `mod.ts`
barrel, so a later bundler can tree-shake at module granularity. No app shell,
DOM rendering library, package-manager runtime dependency, server adapter, or
plugin framework is embedded.

The only browser-capability assumptions are standard Web APIs already called out
by the architecture. If a final browser support matrix exposes a missing
primitive, compatibility should be solved at the capability/adaptation layer
rather than by changing engine semantics.

## Review

The final diff was reviewed locally against the lane specification and DStack
deep-module/TypeScript/Ponytail rules. Two optional external review workers were
attempted but failed to start in the host app and produced no review result;
they were not retried to avoid spawning redundant tabs. No resulting blocker
remains because the executable acceptance gates above cover the lane
requirements and the final source was inspected directly.

## Integration notes

- Keep these modules isolated until the closure/spec lane chooses canonical
  production paths.
- Promote behavior and tests, not necessarily filenames or folder structure.
- Preserve the declared error codes/semantics if a production wrapper is added,
  or version the behavior deliberately.
- Do not add CSV/YAML/PDF/image implementations to this module cluster merely
  for convenience.
