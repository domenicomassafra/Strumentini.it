# 115 — Italian administrative geography source pack

**What to build:** Pin a versioned official source pack for Comuni/Belfiore and foreign-state codes, including historical/suppressed status and stable identifiers needed by Codice Fiscale and administrative lookups.

**Traces to:** US-EXP-07; AC-07.1; DEC-EXP-04

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** Official SITUAS bulk coverage now exists for suppressed municipalities and foreign states, but it still contains explicit code gaps: 16 distinct suppressed municipalities have `COD_CATASTO=ND`, and the foreign-state history is scoped only from 1990 with historical rows lacking `COD_AT`. ARCOM does not expose a reproducible complete historical/suppressed bulk export. Ticket 07 is complete.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-typescript → code-tdd

- [x] Every pinned partial snapshot records authority, source URL, checkedAt and effective coverage.
- [ ] Historical/suppressed municipalities are represented rather than silently replaced.
- [x] Snapshot hash/version is test-addressable.

**Verification:** Known current, historical, suppressed and foreign-state fixtures plus snapshot hash.

**Progress (2026-10-07 fresh official re-evaluation):** ISTAT's SITUAS public API materially improves the evidence. Report 128 (`Elenco comuni soppressi e non ricostituiti`) is a machine-readable bulk list from 1861 and includes `COD_CATASTO`, whose metadata names Agenzia delle Entrate as source; the checked response contains 2,637 rows. However, 18 rows spanning 16 distinct `(PRO_COM_T, COMUNE)` identities carry the official unavailable value `ND`, so complete historical/suppressed four-character coverage is still not proven. Report 469 (`Storico Paesi esteri`) is also machine-readable and includes Agenzia `COD_AT`, but its declared coverage begins on 1 January 1990; 239 of 262 rows carry a code and 23 do not, including the historical entities Germania Ovest and Yemen del Nord. ARCOM continues to support authoritative point searches for suppressed municipalities/foreign states, while its report menu exposes current-situation exports behind CAPTCHA rather than a reproducible complete historical bulk. `quality/reference-data/italy/115-administrative-geography-evidence.json` records the exact official endpoints, observed SHA-256 values, counts and the 16 missing suppressed identities. Ticket 115 therefore remains `BLOCKED`; no code is inferred from successor municipalities, names, point queries or private/community datasets.
