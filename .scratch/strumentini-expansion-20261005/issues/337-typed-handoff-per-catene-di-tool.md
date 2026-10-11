# 337 — Typed handoff per catene di tool

**What to build:** Output passa al tool compatibile senza download/reupload.

**Traces to:** OWN-08; decisioni OWN canoniche del 2026-10-10.

**Constraints:** Scope planning; app local-first, account optional, data protection, proprietary licensing, 0 additional cost initially, mobile base+advanced and WCAG 2.2 AA. Preserve historical AC and no upload implicit.

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; add inclusive-design, security-audit, pdf, primary-sources as required.

**Level:** base

**Priority:** P1; concrete job/risk.

**Current evidence:** 2026-10-10 independent audit, historical only; new implementation requires fresh source-bound proof.

**Donor / reuse decision:** Inspect current code/manifest and installed dependencies before any replacement; assess license, provenance, memory/mobile and CSP before adopting.

## Acceptance criteria

- [ ] AC-337.1: Output passa al tool compatibile senza download/reupload.
- [ ] AC-337.2: Blob scaduto e limite 64MiB gestiti in modo esplicito.
- [ ] AC-337.3: On the scoped input and failure cases, verify: PDF→pages e PNG→compress e CSV→export. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** PDF→pages e PNG→compress e CSV→export; independently inspect output/record and test bounded failures.

**Failure and recovery:** Explicit support/size/timeout limits; cancel/retry must preserve prior good state and must not duplicate side effects.

**Owner or external gate:** Only actual source/consent/security/physical requirements of this scoped ticket; no owner visual-selection blocker applies to an independent bug or engine change. This planning ticket does not approve deploy.

**Rollback:** Scope-limited undo keeping route, local state and former valid receipt. No production deploy in this ticket preparation.

**Out of scope:** New framework, paid acquisition, false Gold, hidden uploads, modifying historical evidence or overriding closed refusals.

**Execution routing:** See EXECUTION-PROMPTS.md in this backlog; currently planning only.

## 2026-10-11 implementation wave 02 — narrow PDF handoff

`src/runtime/ephemeral-file-handoff-337.ts` and `src/components/tools/pdf/PdfTool.tsx` now provide one real explicit user-triggered flow: locally verified <=64 MiB PDF result → same-origin popup `/tools/pdf-to-images/`, 30 s sender/receiver expiry, UUID fragment capability, origin+Window source validation, one-shot ACK, native destination File via `setFiles` without reselect, no network transfer/persistence or automatic execution. Existing PDF manifest does not claim generic input handoff; source/destination are narrowly audited and bounded. Focused tests 19/19 PASS. Isolated Chromium `pdf-merge` produced verified merged.pdf 1.9 KiB, recipient populated without picker; zero outbound POST / JS page errors. Browser harness had unrelated dev GET 404 and exited nonzero, so no clean full browser acceptance claim.

**Residual:** generalized PDF/PNG/CSV typed chains and adversarial expiry browser corpus still unproven. No Gold/release promotion or remote provider claim.

## 2026-10-11 implementation wave 03 — PNG → image compression

Premessa ricontrollata sul codice locale: PDF→pages era già operativo nel runtime/consumer PDF; PNG→compress mancava. Lo stesso runtime `src/runtime/ephemeral-file-handoff-337.ts` ora espone un adapter tipizzato `image/png` verso `/tools/image-compression/`, usando soltanto artifact locali verificati, bytes reali e File nativo. `ImageResultV2` offre il pulsante quando il risultato è un singolo PNG verificato e il tool sorgente non è già la compressione; `ImageVisualTool` riceve il File nello stato del compressore, presenta un messaggio accessibile e lascia all'utilizzatore l'avvio esplicito. Nessun download/reupload/upload, autostart o scrittura persistente nel protocollo.

Controlli effettivi: preflight su kind, MIME, verifica/download ready, firma/header/trailer PNG, estensione, dimensione reale fino a **64 MiB**; capability UUID v4 nel fragment URL, origin e Window opener vincolati, targetId/format tipizzati, expiry sender+receiver **30 s**, un solo payload e un ACK solo dopo il consumo sincrono. Se consumer rifiuta, è occupato o lancia errore, invia `rejected` e il mittente mostra l'errore, senza falso `received`. Popup bloccato, payload non valido, scadenza e opener indisponibile hanno comportamento esplicito; l'originale rimane disponibile in sorgente. Tutte le altre catene sono escluse dai nuovi adapter.

**Prove corrente (2026-10-11, Mac Studio):** `vitest run tests/ephemeral-file-handoff-337.test.ts tests/binary-handoff.test.ts` **17/17 PASS**, compresi payload falsificati e wrong-origin/window, consumi one-use, expiry, dimensione reale 64 MiB+1, popup bloccato, false ACK e ricezione invalid; `tsc --noEmit --pretty false` **PASS**. `node tests/acceptance-ephemeral-file-handoff-337.browser.mjs` **3/3 browser PASS** (Chromium, Firefox, WebKit): risultato PNG verificato nella vera UI `ImageResultV2` → apertura popup compressione → `ImageVisualTool` con file già ricevuto e nessuna auto-elaborazione → click manuale → risultato scaricato, riaperto da decoder Sharp indipendente (PNG 144×96, tre pixel confrontati con valori attesi calcolati indipendentemente); popup bloccato con errore visibile, nessuna richiesta off-origin e nessun errore JS. `python3 .scratch/strumentini-expansion-20261005/ticket_dashboard.py --check` **PASS** (zero mismatch, status canonico `ready-for-agent` mantenuto per ticket aperto). La fixture genera il risultato immagine in browser e verifica il passaggio via componenti reali, senza rivendicare un test da ogni possibile tool sorgente o un dispositivo mobile fisico.

**Resta OPEN:** AC-337.1 e AC-337.3 non sono integralmente soddisfatti finché **CSV→export** non viene implementato e provato nello scope autorizzato da chi possiede i componenti CSV shared. Nessuna modifica CSV condivisa, PdfTool, ticket #339/#341/#347, DAG/dashboard/docs, nessun deploy/commit/Gold. Il precedente handoff PDF mantiene test regression passati; nessuna nuova certificazione browser PDF è stata effettuata in questa wave.
