# 173 — IPv4 and IPv6 CIDR calculator

**What to build:** Add BigInt-safe local subnet calculation for IPv4/IPv6 including prefix, network/range/count and IPv4-specific broadcast semantics where applicable.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** None — dependency 91 is completed.

**Status:** completed

**Suggested skills:** code-typescript → code-module-design → code-tdd

- [x] IPv6 arithmetic never passes through lossy JS Number.
- [x] IPv4 /0,/31,/32 and IPv6 /0,/127,/128 are defined.
- [x] Broadcast is not fabricated for IPv6.

**Verification:** RFC-known literals and boundary prefixes.

**Evidence:** `src/engines/developer-web/network-numeric.ts` parses IPv6 into a 128-bit `bigint` and keeps network/range/count arithmetic in `bigint`; IPv4 exposes subnet/wildcard/broadcast plus explicit RFC 3021 `/31` and single-host `/32` semantics, while IPv6 returns `broadcastSemantics: "not applicable to IPv6"` with no fabricated `broadcast` field. `tests/developer-network-numeric.test.ts` exercises IPv4 `/0,/31,/32`, IPv6 `/0,/127,/128`, the maximum IPv6 literal and exact decimal counts. The dedicated route is local-only through the shared `DeveloperWebTool`/`developer-web` engine. Focused developer tests pass 39/39; `npx tsc --noEmit --pretty false`, `npm run catalog:check`, direct Astro build (223 pages), and `git diff --check` pass.
