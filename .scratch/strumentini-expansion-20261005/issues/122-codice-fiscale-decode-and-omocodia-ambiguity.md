# 122 — Codice Fiscale decode and omocodia ambiguity

**What to build:** Add decoding of encoded facts and municipality/foreign candidates while preserving omocodia ambiguity instead of inventing a unique real-world identity.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 121 — Codice Fiscale formal validate and generate engine.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-tdd → inclusive-design

- [ ] Decode reports only facts encoded/formally derivable.
- [ ] Omocodia substitutions remain explicit candidates/ambiguity.
- [ ] Historical municipality mappings retain source/version context.

**Verification:** Omocode-position, impossible-date and historical-municipality cases.
