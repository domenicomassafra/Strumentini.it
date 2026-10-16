# 348 — Server opt-in gratis feasibility

**What to build:** Comparare locale/server per quota hard costo e consenso.

**Traces to:** OWN-10 OWN-14; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** completed

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** feasibility

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [x] AC-348.1: Comparare locale/server per quota hard costo e consenso. **Feasibility/NO_GO:** confronto e fonti ufficiali del 2026-10-11 in `docs/feasibility-server-optin-348-2026-10-11.md`, con piano/account/costo reale esplicitamente sconosciuti.
- [x] AC-348.2: Over-quota fallback locale o indisponibile, mai upload silenzioso. **Verificato nell'ambito feasibility:** checker statico blocca nuove route e primitive di trasporto, simulatore quote rifiuta con fallback `local`/`unavailable`, senza introdurre alcun server job. Runtime end-to-end, vendor e azioni future `NOT_RUN` (non è un certificato di assenza universale di upload).
- [x] AC-348.3: On the scoped input and failure cases, verify: Budget/stress/threat model. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent. **Verificato:** test negativi, limiti CPU/byte/D1/requests, minacce e casi non verificabili con decisione `NO_GO`, nessun deploy.

**Verification:** Budget/stress/threat model; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

**Proof 2026-10-11:** `npx vitest run tests/feasibility-server-optin-348.test.ts` **11/11 PASS**; `npx tsx scripts/feasibility-server-optin-348.ts` **PASS** con `baselineSafe=true`, `serverMode=NO_GO`, 19 route, 0 violazioni, 1.620 file ispezionati nella sorgente first-party in scope. Studio e limiti in `docs/feasibility-server-optin-348-2026-10-11.md`; implementazione eseguibile in `scripts/feasibility-server-optin-348.ts`. **Il ticket è chiuso come studio di fattibilità negativo**, non come autorizzazione all'esecuzione server; verifiche live/consenso fisico/quote account assenti sono etichettate `NOT_RUN`.

**2026-10-11 review del nuovo #340:** l'inventario statico ha rifiutato correttamente un cambiamento a `src/pages/preferiti.astro` con `CHANGED_BROWSER_TRANSPORT`, benché il diff fosse confinato all'import/isola locale SessionChain340 e a CSS con token condivisi. Revisione byte-per-byte della route: l'unica chiamata `fetch("/api/auth/session", { credentials: "same-origin" })` è identica al commit precedente; nessun endpoint, metodo POST, trasporto o Worker cambiato. Aggiornato **soltanto** il fingerprint di questa route al SHA-256 corrente `5d5bad4a5109593163396b428bf7d09ce0cfac59ea897b14fc763114d0bb0127` nel suo inventario conservativo, senza allentare il pattern di rifiuto o consentire nuove route. Nuovo test adversariale: una successiva chiamata POST non autorizzata aggiunta a `/preferiti/` torna `CHANGED_BROWSER_TRANSPORT`; suite #348 **12/12 PASS** e gate `serverMode=NO_GO` invariato. Non è stato attivato nessun backend opzionale o upload.

**2026-10-12 riconciliazione del logout #328 (senza espansione server):** la suite cumulativa ha segnalato correttamente `CHANGED_BROWSER_TRANSPORT:src/components/account/AccountChip.astro` dopo la correzione del falso logout. La revisione del diff conferma esattamente le due chiamate preesistenti: `GET /api/auth/session` e `POST /api/auth/logout`. È cambiata soltanto la gestione del risultato: il client naviga alla homepage solo se il Worker conferma HTTP 204; HTTP 503, fallback HTML 200 e guasti di rete lasciano la sessione visibile e permettono un nuovo tentativo. Il fingerprint conservativo di `AccountChip.astro` è stato aggiornato a SHA-256 `1cca61e9d06940358a3bece7e7bf26232c645dafb774a99181682ce38b571402`, con nuovo test di rifiuto per destinazione alterata o POST aggiuntivo. La protezione contro trasporti non revisionati resta attiva, nessuna nuova route, quota, provider o chiamata è approvata. Studio originario di fattibilità `NO_GO` invariato, nessuna certificazione di login/Cloudflare o deploy.

**2026-10-14 integrazione pulita #328, source transport admission RED→GREEN:** la candidata cumulativa `9fedcadaa6ab1b0a9b923249a2130b031f95fde4` ha rifiutato correttamente `src/components/account/auth-client.ts` con `CHANGED_BROWSER_TRANSPORT` nel test #348 perché il nuovo login verificato su cookie non era ancora attestato nell'inventario dei byte del browser. Il diff esatto #328 aggiunge soltanto una GET aggiornata `cache: "no-store"` all'endpoint già autorizzato `/api/auth/session` dopo POST login/registrazione verso gli endpoint già ammessi, con `credentials: "same-origin"`, verifica dell'identità e rifiuto HTTP 503 senza sessione attestata. Non sono state aggiunte nuove route, domini, invii file o trasporti. Il file verificato corrisponde alla punta remota #328 `eeaadd2afcf0f60bed1f205ff2d41fbf8acb3ac8` e SHA-256 `b32363ed352edf1a2b97c5f1cfc4650c0d46d55731cdf2e11e2fc354fb8b8f21`. Solo dopo questa revisione il baseline `BROWSER_TRANSPORT_SHA256` viene aggiornato a quel digest, mantenendo il rifiuto per ogni modifica successiva, inclusi POST offsite, perdita di `cache: no-store` o `credentials: same-origin`; il test adiacente documenta positivi e negativi. Originale feasibility #348 resta NO_GO per qualunque nuovo server opt-in; Siteverify/Cloudflare D1 staging e device restano NOT_RUN per #328. Nessun upload o consenso Gold/provider/PR derivante da questa attestazione.
