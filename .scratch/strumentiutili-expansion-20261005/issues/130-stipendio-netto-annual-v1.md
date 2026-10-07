# 130 — Stipendio netto annual v1

**What to build:** Compose supported employee contributions and IRPEF into RAL→contributions→tax→net annual/monthly, separating tax math from 12/13/14-payment presentation and avoiding payroll-cert accuracy claims.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 128, 129.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd → inclusive-design

- [ ] Annual components reconcile to displayed net.
- [ ] 12/13/14 installment display cannot alter annual tax result.
- [ ] Contract/region/profile assumptions are visible in result.

**Verification:** Hand-worked annual case plus payment-month reconciliation fixtures.
