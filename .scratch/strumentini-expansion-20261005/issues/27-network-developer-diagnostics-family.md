# 27 — Network/developer diagnostics family

**What to build:** Add local subnet/CIDR calculations for IPv4/IPv6, numeric base conversion 2–36, chmod/Unix permission helper, X.509/CSR inspector, and keyboard-event diagnostics; reuse the existing user-agent/URL/hash ecosystem instead of duplicating it.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-07

**Constraints:** Inspection/calculation only; no port scanning, exploitation, credential attacks, or hidden network requests.

**Blocked by:** 173, 174, 175, 176, 177.

**Status:** completed

- [x] Ticket 173 covers IPv4/IPv6 network ranges and prefix arithmetic with BigInt-safe IPv6 behavior and explicit IPv4 broadcast semantics.
- [x] Ticket 177 parses local X.509/CSR facts and fingerprints while explicitly refusing trust/revocation inference.
- [x] Tickets 174–176 provide exact base conversion, chmod symbolic/octal representations and keyboard-event diagnostics through copyable shared Result v2 surfaces with no hidden network activity.

**Verification:** Developer network-numeric, browser-diagnostics and X.509/CSR focused suites plus browser acceptance cover standards/literal vectors and zero-network local behavior.
