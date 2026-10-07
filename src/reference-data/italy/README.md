# Italy reference-data framework

This folder is the shared contract for versioned Italian fiscal, administrative, calendar, social-security, and technical reference packs. Calculators and lookup tools should consume a selected `ItalyReferenceVersion`; they should not embed time-varying rates, brackets, coefficients, codes, or source dates as unexplained constants.

Each version declares a stable dataset/version pair, optional annual reference year, inclusive effective interval, `checkedAt` date, SHA-256 snapshot hash, and at least one HTTPS source identified as an official authority. The pack data stays local at runtime. Ordinary calculations therefore do not require live scraping or a network check.

Use `createItalyReferenceRegistry()` once for the packaged versions, then select explicitly with `byVersion()`, `byYear()`, or `atDate()`. Missing years/dates/versions throw `ItalyReferenceDataError`; the registry never substitutes the newest available pack. Effective intervals for the same dataset may not overlap, because a date must resolve to exactly one source pack.

`getItalyReferenceProvenance()` returns only the version/source metadata needed by tests and result UI. `loadItalyReferenceBoundaryFixtures()` exposes declared edge cases by stable `targetId`, so downstream rule packs can attach below/at/above or before/after cases to every threshold, bracket, rate, coefficient, code, or effective-date change.

The framework intentionally contains no normative fiscal or administrative values. Those belong in separately reviewed source-pack tickets and must cite the governing official authorities.

\`source-packs.ts\` is the machine-readable readiness layer for tickets 115–120. It binds each source-pack/feasibility decision to a versioned evidence snapshot under \`quality/reference-data/italy/\`, its SHA-256 identity, \`checkedAt\` date and an explicit freshness/review trigger. \`READY\` is fail-closed: it requires at least one sufficient official source. \`BLOCKED\` and \`REFUSED\` records may describe admissible candidate metadata, but that metadata is never promoted to normative values until the exact governing publication/artifact is vendored and reviewed.
