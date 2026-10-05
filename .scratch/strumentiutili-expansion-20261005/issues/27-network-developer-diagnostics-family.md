# 27 — Network/developer diagnostics family

**What to build:** Add local subnet/CIDR calculations for IPv4/IPv6, numeric base conversion 2–36, chmod/Unix permission helper, X.509/CSR inspector, and keyboard-event diagnostics; reuse the existing user-agent/URL/hash ecosystem instead of duplicating it.

**Traces to:** US-EXP-05, US-EXP-10; AC-05.1, AC-10.1; DEC-EXP-01, DEC-EXP-06; C-EXP-04, C-EXP-07

**Constraints:** Inspection/calculation only; no port scanning, exploitation, credential attacks, or hidden network requests.

**Blocked by:** 01.

**Status:** blocked

- [ ] CIDR tool covers network/broadcast/host ranges, masks/wildcards, prefix conversion, and IPv6-safe arithmetic.
- [ ] Certificate inspector shows parsed facts/fingerprints without implying online trust validation.
- [ ] Base/chmod/key-event tools have copyable human and machine representations.

**Verification:** Standards-based vectors for IPv4/IPv6/base/permissions/certificate parsing and a no-network assertion for all local modes.

