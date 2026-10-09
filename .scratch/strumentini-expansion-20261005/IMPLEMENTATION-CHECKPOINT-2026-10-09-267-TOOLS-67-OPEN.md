# Strumentini.it — handoff operativo 2026-10-09, 267 strumenti / 67 ticket aperti

> Stato verificato sul Mac Studio, repo `/Users/domenico/Code/Strumentini.it`. Non è un certificato di release/Gold o un permesso di deploy. Handoff storico precedente: `IMPLEMENTATION-CHECKPOINT-2026-10-09-VIDEO-308-70-OPEN.md`.

## Authority e confini

- `main` **sincronizzato su GitHub `origin/main` al commit `6d1593b`** dopo full-suite, check, build e prove browser. Repository HTTPS `https://github.com/domenicomassafra/strumentini-it.git`; **nessun deploy**, nessuna nuova Gold promossa.
- Dashboard canonica in `.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.{md,json}` e `ticket_dashboard.py`. Stato dopo #251: **327 ticket, 260 completati (18 chiusi per REFUSAL: non equivale a funzionalità), 67 aperti, 14 ready-for-agent, 45 dependency-blocked, 2 external-source, 5 external-device, 1 capability-blocked, 0 mismatch**.
- Catalogo generato: **267 strumenti** (da 264 del baseline `749fe44`), **257 Gold storici**, **2 PARTIAL**, **8 IMPLEMENTED_UNVERIFIED** senza ricevute Gold. Oracle append-only `cand-265` PDF n-up, `cand-266` Printable PDF, `cand-267` Booklet/interleave, niente alterazioni a `cand-001…264`.
- Ultima suite integrata con #251 e #246: `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **1349/1349 PASS, 175/175 file**. `npm run check`: **0 errors, 0 warnings, 17 hints** su 1774 file. `npm run build`: **287 pagine PASS**, 632 assets JS, 7144 B JS iniziale. `npm run certification:check` e `npm run tickets:check`: PASS.
- Browser verifiche: #250 `npx tsx tests/pdf-n-up-250.browser.ts` PASS (5 page/2 sheets/3 white), #251 `npx tsx scripts/acceptance-pdf-booklet-interleave-251.ts` PASS (14/14 page PNG independently decodificate; 0 offsite), #256 `npx tsx scripts/acceptance-printable-pdf-all-pages-256.ts` PASS (23/23 pagine TXT/CSV; 3908 text runs; 0 clipped), #308 `node tests/video-contact-sheet-308.browser.mjs` PASS (28 checks). #059 download multi-browser Chromium/Firefox/WebKit 18/18 PASS.

## Ticket consegnati e codice

| Ticket | Stato | Commit e prove | Limiti |
|---|---|---|---|
| #308 Contact sheet video | completed | `4d4b287`, `9b0ff30`: real MP4 frames, SHA, ZIP, browser 28/28 | 160ms presented-time tolerance; non frame-perfect, no physical |
| #250 PDF n-up | completed | `1ce32d4`: 2/4/custom griglie, padding, real PDF.js pixels | raster JPEG perde vettori, testo, link |
| #256 TXT/MD/HTML/CSV→PDF | completed | `73cfe77`, `aeab8fe`: 23 pages full render, 3908 text runs | Courier WinAnsi, bounded CSV, no arbitrary rich HTML/PDF-A |
| #251 Booklet e interleave | completed | Worker `29e9c98`, integrato con registry/copy/QA in `6d1593b`: 14 pagine PDF browser | booklet raster, printer-duplex hardware non certificato |
| #212 HEIC/AVIF/GIF | open | `e67b74d`: bounded GIF timing + animation-loss disclosure | HEIC real iPhone/physical mobile e approved codecs mancanti |
| #218 Scan PDF compression | open | `36bd2e4`: opt-in Flate RGB/gray predictor→JPEG, real PDF re-render | DPI full corpus, mixed scans/physical parity mancanti |
| #059 Minify pack | open | `4bb6522`: XML/SVG whitespace semantics, cross-browser downloaded minifications | produzione SVG optimizer REFUSED #209/#268 |
| #246 Local OCR | open | `a568c57`: fail-closed no production; real desktop Tesseract Italian fixture recognized, 6/6 focused tests | #271 REFUSED physical/memory/cancel, no public OCR model/UI |
| #037 Video/subtitle | open | `73df763`: reconcile 2/3 AC (subtitle + presented-frame), current video presentation timing worker in progress | strict CFR/VFR PTS proof, physical media checks incomplete |

## Attività parallele ancora in corso nel momento di questo checkpoint

Due subagenti riutilizzati con `.agents` (prime unico integratore/publisher). Worktrees NON toccare con reset/clean brutali, conservare `node_modules`, `.vitest`, harness e script `worker4-preserved`.

1. **Worker-2** `/Users/domenico/Code/Strumentini-wt-232`, ticket **#037** PTS CFR/VFR MP4. Source cambia SOLO `src/engines/video/mp4-inspection.ts`, `src/components/tools/video/video-presentation.ts` e nuovi tests `tests/video-presentation-timing-37.test.ts`; preserva i due AC #037 già marcati da prime. **17/17 targeted PASS**, FFprobe real files `video-12fps.mp4` (CFR) / `video-vfr.mp4` (VFR), PTS sorted `stts+ctts`, identity edits/validated stsz, malformed/fragment/unknown fail closed. Avviso: **9 test storici** #232 che pretendono `frameRateMode=unknown` su *tutti* i video vanno aggiornati con aspettative per-file, non aggirare assertions. Worker deve consegnare SHA; cherry-pick sicuro dopo verifica. #037 resta aperto se manca mobile/ulteriore AC.
2. **Worker-1** `/Users/domenico/Code/Strumentini-wt-218`, branch isolato `sprint/str-254-pdf-tables`, ticket **#254 PDF tables→XLSX**. Obiettivo subset ristretto: PDF.js region/grid **esplicitamente selezionata** e linee ruled (non OCR generico), previa anteprima, provenienza pagina, XLSX con leading zeros/formula-safe, real independent reopen. Candidate `cand-268` SOLO se route effettivamente pronta; prime possiede registrazione `quality/oracles/registry.json`, `src/i18n/it/tool-copy.ts`, generated catalog e certification tests. Nessun Gold/physical/deploy/push dal worker. Se non si dimostrano tre AC, lasciare `ready-for-agent`.

## Prossima integrazione controllata

1. Verificare stato worker e loro SHA (non usare cherry-pick di commit iniziali già integrati; no reset degli untracked). #037: mantenere enum `unknown` per frammentati/edit ambigui, adattare legacy #232 tests SOLO dove real FFprobe/PTS evidenzia risultato; `npm run check`, targeted + full suite. Non certificare VFR se prova incompleta.
2. #254: controllare prova browser su griglia reale e indipendente XLSX; se nuova route aggiungere `cand-268` **append-only** e `ItalianToolPage` con un solo client component, aggiornare test hard-coded tool/Gold frontier; generare `catalog:build`, `certification:build`, `tickets:sync` in quest'ordine prudente con gate coerenti. Evitare il vecchio errore `Status` non canonico e preservare sempre `**Blocked by:**` nell'issue per il parser dashboard.
3. QA unica dopo merge di blocchi: `npm run tickets:check`, `npm run certification:check`, `npm run check`, `npm run build`, `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`, browser real downloads. Nessuna fake Gold; fisici e fonti ufficiali restano gate.
4. Solo con QA verde: commit selettivo di integration + dashboard + handoff, controllare `git rev-list --left-right --count origin/main...HEAD` e push `main` se non c'è divergenza. Verificare SHA locale/remoto identici. **Nessun deploy automatico**.
