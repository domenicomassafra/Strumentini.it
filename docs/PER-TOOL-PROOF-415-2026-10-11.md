# #415 — Inventario attuale dei claim e delle prove per strumento

**2026-10-11, tranche source-local; ticket ancora APERTO.** Il generatore `scripts/audit-per-tool-proof-415.ts` è un audit read-only, senza nuovi receipt, senza modifica Gold, senza API di rete o dati utente. Esecuzione:

```sh
./node_modules/.bin/tsx scripts/audit-per-tool-proof-415.ts
./node_modules/.bin/tsx scripts/audit-per-tool-proof-415.ts --json
./node_modules/.bin/vitest run tests/per-tool-proof-415.test.ts
```

`--json` emette una riga per **ogni route corrente** (269/269, ID unici), con lavori dichiarati nel manifest, input, classe risultato, limiti **handoff maxBytes solo dove espressamente dichiarati**, riferimenti a oracolo e famiglie di fixture, esistenza manifest/pagina, SHA dei file contro inventario storico, riferimenti *storici* ai receipt etichettati separatamente, e stato di certificazione **VERIFIED solo con receipt corrente riletto in byte** oppure **PENDING**. Non viene mai rappresentato `GOLD` storico dell'indice esteso come Gold di release corrente.

## Risultato misurato

| Ambito | Esito |
|---|---:|
| Route/manifest/pagine tracciati | 269 / 269 |
| Manifest, modulo, pagina confrontati con digest inventario storico | 269 / 269 |
| Oracolo e famiglie fixture esistenti nel registry | 269 / 269 |
| Limiti `maxBytes` espliciti di handoff (non automaticamente equivalenti ai limiti runtime) | 43 / 269 |
| Limite runtime eseguibile attestato direttamente da questo controllo | 0 / 269 |
| Limiti runtime da auditare nei renderer/engine | 226 / 269 con nessun maxBytes nel manifest |
| Ricevute Gold correnti source-bound accettate | 0 / 269 |
| Tool con proof corrente non dimostrata | 269 / 269 — PENDING |

Gli SHA di un vecchio inventario e la presenza di fixture/oracoli sono **tracciabilità delle fonti**, non prove che tutte le operazioni, i timeout, i formati o i limiti siano stati verificati contro la versione corrente. La verifica dei receipt controlla percorso nel root consentito, identificativo, schema/stato, SHA dei byte, revisione Git, fingerprint attuale anche di Worker/D1, runtime/oracoli/famiglie in accordo col manifest; rifiuta mismatch, tamper e contenuti non attendibili. Fixture sintetiche positive/negative non creano né certificano ricevute reali.

Il campione di **prove indipendenti a livello di formato** è stato rieseguito con `scripts/verify-output-consumers-408.ts`: PDF/PDF.js, PNG/Sharp, CSV/RFC4180 separato, DOCX/fflate+sax, XLSX/read-excel-file, WAV/RIFF PCM16: **6/6 PASS_LOCAL**. È un campione di *producer/consumer di formato*, non una prova per i 269 strumenti né un'abilitazione Gold. Rendering Word/Excel reale, playback fisico WAV e iOS/Android restano NOT_RUN.

## Aree ancora aperte

1. Portare tutti i limiti runtime pertinenti (dimensioni reali, record, timeout, cancellazioni, degradazioni e rifiuti) a dichiarazioni versionate e verificabili per ogni engine/route, senza confondere `handoff.maxBytes` con i limiti di elaborazione.
2. Raccogliere un vero risultato indipendente per route/famiglia con casi invalidi, grandi, parziali e cancellati, e integrare legame al revision/source hash corrente. Il formato solo non basta.
3. Solo dopo, eventualmente emettere nuovi receipt source-scoped positivi tramite procedura ufficiale, risolvendo prima #347 (fingerprint con auto-riferimento), vendor/source rights, prove browser/physical e release gate. **Non è stata emessa alcuna ricevuta.**

Questo inventario dà una vista rigorosa degli stati PENDING e dei gap per scegliere le prossime implementazioni. La costruzione dell'inventario non chiude la certificazione per-tool; release **NO-GO**.
