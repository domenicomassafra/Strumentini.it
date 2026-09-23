# 01 — Gold tracer: Business Day Calculator

**What to build:** Create the smallest deployable Astro + Preact + strict-TypeScript product slice and make Business Day Calculator work end to end through a real manifest, generated catalog metadata, lazy registry, Tool Runtime, date/time engine, visible Work Profile defaults, user-facing operation surface, independent correctness fixtures, and a generated Gold receipt. The calculation uses an explicit workweek and optional user-entered excluded dates; it does not fetch holiday data.

**Traces to:** US-01 / AC-01.1 / AC-01.2 / AC-01.3 / US-06 / AC-06.1 / AC-06.2 / AC-06.3 / US-07 / AC-07.1 / AC-07.2 / AC-07.3 / AC-07.4 / US-11 / AC-11.1 / AC-11.2 / AC-11.3 / US-12 / AC-12.1 / AC-12.2 / US-14 / AC-14.1 / US-16 / AC-16.1 / AC-16.2 / DEC-10 / DEC-11 / DEC-16 / DEC-17 / DEC-19

**Constraints:** C-01 / C-03 / C-04 / C-05 / C-06 / C-07 / C-08 / C-09 / C-11 / C-12 / C-13 / C-15 / C-16 / C-17 / C-18 / C-20 / C-21 / C-22

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A direct public Business Day Calculator route renders usable HTML and hydrates only its interactive operation surface; no account is required.
- [ ] The production date/profile seams begin by promoting the proven business-day and profile-default behavior/fixtures from the completed core-engine spike; any semantic change is explicit and re-oracled rather than silently reimplemented.
- [ ] Gold certification resolves the tool through the completed oracle registry/fixture index, runs exact independent vectors before property checks, and records source/fixture versions in the receipt; it does not create a second oracle registry or derive golden values from production code.
- [ ] One canonical tool manifest compiles into metadata, route/import mapping, search fields, runtime/privacy declarations, profile fields, and Gold requirements; duplicate/invalid manifest evidence fails the build.
- [ ] The registry can read metadata without loading the tool implementation and lazily loads only the requested tool/engine.
- [ ] Tool Runtime exposes normalized preflight/run result and error behavior and injects only declared Work Profile fields with visible provenance.
- [ ] Business-day behavior has red→green tests from hand-worked calendar fixtures covering empty/invalid input, leap/month boundaries, custom workweek, excluded dates, and locale-display separation.
- [ ] The LOCAL acceptance test observes zero task-content network requests and the UI literally states that the operation runs on this device.
- [ ] The tool page shows task → operation/result → context/trust ordering, formula/rule assumptions, reset, and normalized invalid/success states.
- [ ] The Gold gate generates a receipt tied to relevant manifest/implementation/oracle identity and fails when a required oracle/privacy declaration is sabotaged.
- [ ] Initial build output proves no unrelated tool implementation is bundled/fetched and records a baseline shell/tool bundle measurement.
- [ ] The same static build is compatible with Cloudflare Workers Static Assets and requires no SSR/runtime backend for the tool.

**Verification:** From the production scaffold, run the canonical test, typecheck, build, catalog-policy, Gold-certification, and browser-acceptance scripts established by this ticket; include a browser network assertion for LOCAL execution, a sabotage run that makes manifest/oracle policy fail, and a production-build inspection showing the Business Day chunk is lazy and no unrelated tool chunk is loaded.
