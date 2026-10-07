# 133 — Regime forfettario annual v1

**What to build:** Implement fatturato→coefficiente→reddito→contributi→imponibile→imposta→netto for bounded supported activity/INPS profiles, with 5%/15% tax eligibility entered explicitly rather than inferred.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117, 131, 132.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Coefficient lookup is versioned and source-backed.
- [ ] User must declare 5% eligibility; tool never decides legal eligibility silently.
- [ ] Contribution path is one of the explicitly supported INPS profiles.

**Verification:** Coefficient/rate boundaries and current official-source scenarios.
