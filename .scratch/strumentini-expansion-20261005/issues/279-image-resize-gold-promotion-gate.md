# 279 — Image-resize Gold promotion gate

**What to build:** Re-evaluate image-resize from Partial to Gold only after current desktop/browser evidence and both required physical-device receipts are valid on the same source fingerprint.

**Traces to:** AC-09.1; DEC-EXP-06

**Constraints:** C-EXP-01, C-EXP-02; status is evidence-derived only.

**Blocked by:** 277, 278.

**Status:** blocked

**Suggested skills:** code-tdd → qa-browser

- [ ] All required receipts reference compatible/current source fingerprint.
- [ ] Any physical failure keeps status Partial.
- [ ] Promotion updates certification artifacts without bypass flags.

**Verification:** Certification validator plus fresh image-resize receipt consistency check.

**Evidence check (2026-10-07):** Image Resize remains `PARTIAL`. Ticket 277 has no verifiable physical Android Chrome target/tooling, and ticket 278 reaches the paired physical iPhone but SafariDriver cannot create a real session while Web Inspector is disabled. Neither canonical physical PASS receipt exists, so Gold promotion remains blocked by 277 and 278; any final receipt-identity refresh is secondary to those hard physical gates.
