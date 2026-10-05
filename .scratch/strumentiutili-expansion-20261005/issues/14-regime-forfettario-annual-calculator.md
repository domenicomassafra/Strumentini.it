# 14 — Regime forfettario annual calculator

**What to build:** Add a year-versioned regime forfettario calculator covering activity coefficient, supported INPS management, 15%/5% substitute tax and a clear fatturato→reddito→contributi→imponibile→imposta→netto chain.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-02.2, AC-07.1; DEC-EXP-04; C-EXP-06

**Constraints:** Official annual coefficients/rates only; eligibility is not certified by the tool; unsupported previdential cases must fail honestly.

**Blocked by:** 01 — Result System v2 primitives; 07 — versioned Italy reference data.

**Status:** blocked

- [ ] Activity/coefficient data is versioned and source-linked.
- [ ] 5% startup mode is presented as a user-declared eligibility assumption.
- [ ] INPS calculation scope and exclusions are visible in the result.
- [ ] Every intermediate amount is reproducible from displayed inputs/rates.

**Verification:** Boundary fixtures for coefficients/rates, source-version tests, hand-worked examples, stale-year behavior and browser acceptance with Italian money formatting.
