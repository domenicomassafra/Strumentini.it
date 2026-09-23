# Ticket 04 — production seam mapping

The production client/time/math engine preserves the proven core-spike domain behavior while tightening the numeric and timezone semantics required by the existing Gold fixtures.

## Promoted behavior

- `spikes/core-engines/src/business_math.ts` established the rate-conversion basis: convert through hours, with explicit hours/day and project-hours assumptions. Production keeps that formula and the requirement that project conversions declare project hours.
- The same spike established distinct margin and markup formulas: profit is price/revenue minus cost, margin divides profit by price/revenue, and markup divides profit by cost. Production keeps those formulas and makes zero denominators explicit typed results.
- `quality/fixtures/business-math/vectors.json` remains the independent literal oracle for the hour/day and margin/markup known answers. Production does not derive expected values from its own implementation.
- `quality/fixtures/timezone-dst/vectors.json` remains the independent IANA/RFC3339 oracle for winter/summer offsets plus spring-forward and fall-back behavior. Production uses browser/Node `Intl` for the IANA timezone seam and cross-checks the same vectors with Python `zoneinfo` during Gold certification.

## Exact-decimal change and measured reason

The spike used binary `number` arithmetic and `Math.round((value + Number.EPSILON) * 100) / 100`. The existing `business-math` fixture policy requires decimal arithmetic with no intermediate binary-float rounding. A direct measurement also exposes a correctness gap: the spike rounding expression produces `10.07` for the decimal input `10.075`, while Python `Decimal(..., ROUND_HALF_UP)` produces `10.08`.

Production therefore keeps the spike formulas but represents finite decimal inputs as reduced `BigInt` rational values. It rounds once at the declared output boundary using decimal half-up semantics. This avoids adding a package dependency or changing package metadata and removes the measured binary-float error instead of creating a second business formula.

## Work Profile mapping

The canonical Work Profile currently contains `timezone` and `currency`, but no `workingHours` or `hoursPerDay` field. The new manifests therefore consume the profile values that actually exist while also declaring visible tool defaults for `workingHours` (`09:00–17:00`) and `hoursPerDay` (`8`). The UI labels those as tool defaults rather than attributing them to Work Profile. Current-task edits become explicit overrides through the existing `resolveToolDefaults` precedence seam.

`tests/client-time-math-profile.test.ts` proves the cross-tool projection for Business Day, Timezone Overlap, Rate Converter, and Margin/Markup and verifies that unrelated profile fields are not injected.
