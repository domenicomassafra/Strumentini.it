# 08 — Codice Fiscale generate/decode

**What to build:** Add local Codice Fiscale generation, checksum validation, and decode from an existing code, with municipality/Belfiore lookup, foreign-birth support where the maintained dataset permits it, and explicit handling of omocodia limits.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-02.2, AC-07.1; DEC-EXP-02, DEC-EXP-04; C-EXP-03, C-EXP-05, C-EXP-06

**Constraints:** Personal data stays local; generated code is never described as a substitute for the official Agenzia delle Entrate assignment.

**Blocked by:** 121, 122.

**Status:** blocked

- [ ] Generate, validate, and decode modes are distinct and understandable.
- [ ] Check character and date/sex/month rules have independent official-source fixtures.
- [ ] Municipality/foreign-code dataset has version/source metadata.
- [ ] Omocodia ambiguity is surfaced rather than guessed away.

**Verification:** Official-rule vector suite plus browser tests showing no identifier leaves the device and clear result limitations.
