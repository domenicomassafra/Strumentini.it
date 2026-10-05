# 22 — Password/passphrase/security family

**What to build:** Add local password, Italian passphrase and PIN generation plus password-strength estimation using cryptographically secure randomness and an explainable estimator.

**Traces to:** US-EXP-05, US-EXP-09; AC-09.1; DEC-EXP-02; C-EXP-05, C-EXP-07

**Constraints:** Use Web Crypto randomness; never upload generated secrets; strength labels must not promise resistance or reuse breached-password data without an explicit network mode.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] Generators use rejection sampling or equivalent unbiased selection.
- [ ] Passphrase wordlist provenance/version is documented.
- [ ] Strength output explains length/pattern observations and limitations.
- [ ] Copy/reveal controls avoid accidental persistence in URLs/history.

**Verification:** Randomness-path unit tests, constraint/property tests, privacy/network assertions and browser acceptance including clipboard behavior.
