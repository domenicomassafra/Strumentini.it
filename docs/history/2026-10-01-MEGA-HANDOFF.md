# MEGA-HANDOFF — StrumentiUtili.it (per continuare con un altro LLM)

> **ARCHIVIATO IL 2026-10-03.** Questo handoff fotografa lo stato del 2026-10-01 (99 Gold / 1 Partial / 100 unverified) ed è conservato solo come cronologia. Non usarlo come fonte operativa. La fonte corrente è `/PROJECT-STATUS.md`, poi `/HANDOFF.md`, `/ROADMAP.md` e `quality/receipts/expanded-catalog-certification.json`.

Data: 2026-10-01. Lingua pubblica del prodotto: **solo italiano**. Lingua di questo documento: italiano.

## 1. Stato in una riga

Repo: `https://github.com/domenicomassafra/strumentiutili-it` (privato).
Checkout canonico e unico: `/Users/domenico/Code/StrumentiUtili.it`, branch `main`, `main == origin/main`, albero pulito.
Ultimi commit: `3a89730` (recertify 99 Gold), `cd3b2f2` (tranche italianizzazione + batch data-table/date-time/text-writing).
Verde certificato: `npm test` 331/331 (47 file), `astro check` 0/0/0, build statica 204 pagine, `gold:sabotage` PASS.
Frontiera: **99 Gold / 1 Partial (`image-resize`) / 100 `IMPLEMENTED_UNVERIFIED`** su 200 tool.

## 2. Cos'è il prodotto (non reinventarlo, leggi i canonici)

- Workspace personale di utility per lavoro della conoscenza (freelance, consulenti, solopreneur, creator, micro-agenzie). Onboarding per ruolo → starter toolbox da 10 tool → pack professionali, ricerca/palette, Workbench persistente, config portabile.
- Shell statica/PWA, TypeScript, esecuzione deterministica locale nel browser; niente DB remoto di file utente; niente LLM per uso normale.
- Documenti canonici (leggerli prima di toccare il prodotto): `HANDOFF.md`, `ROADMAP.md`, `PRODUCT.md`, `PRODUCT-SPEC.md`, `PRODUCT-MARKETING-CONTEXT.md`, `IMPLEMENTATION-PLAN.md`, `docs/05-brand-positioning.md`, `docs/06-go-to-market.md`, `docs/07-tool-factory-quality-standard.md`, `research/competitive-brand-gtm-2026-09-23.md`, `research/free-scale-monetization-stress-test-2026-09-23.md`.
- Differenziatori dichiarabili solo se veri; non vantare originalità su: conteggio tool, categorie, preferiti, privacy client-side, "tutto in un posto", calcolatori freelance, trasparenza formule. Conta come dimensione pubblica **solo il numero di tool Gold**, mai i 200 implementati.

## 3. Mappa certificazione attuale (da `quality/receipts/expanded-catalog-certification.json`)

| Engine | Gold | Non Gold | Note |
|---|---|---|---|
| business-math | 16 | 0 | completo |
| developer-web | 20 | 0 | completo |
| table-operations + table-csv (data-table) | 20 | 0 | completo |
| date-time | 18 | 1 | quasi completo |
| text-writing | 15 | 4 | quasi completo |
| campaign-url | 3 | 0 | completo |
| client-time-math | 3 | 0 | completo |
| text-research (engine `research-reference`+?) | 3 | 0 | completo |
| csv-cleaner, file-hash, business-day, text-list | 5 | 0 | singoli Gold |
| image (`image-resize`) | 0 | 1 | **PARTIAL by-design** (manca evidenza fisica iOS Safari + Android Chrome, ESTERNA: non inferirla mai da desktop/emulazione) |
| pdf | 0 | 20 | da certificare (P1) |
| research-knowledge | 0 | 20 | da certificare (P1) |
| file-privacy | 0 | 19 | da certificare (P1) |
| image / image-visual | 0 | 19 | da certificare (P1, occhio alle API browser/file/canvas) |
| url-marketing | 0 | 12 | da certificare (P1) |
| marketing-math, qr-local, misc | 0 | ~9 | da certificare (P1) |

Verifica sempre la tabella reale con:
`python3 -c "import json; d=json.load(open('quality/receipts/expanded-catalog-certification.json')); from collections import Counter; [print(k,v) for k,v in sorted(Counter((t['engine'],t['status']) for t in d['tools']).items())]"`

## 4. Fatto nelle ultime tranche (non rifarlo)

1. `cd3b2f2`: italianizzazione superfici condivise (pagine tool, errori `src/i18n/it/errors.ts`, icone `src/ui/tool-icons.ts`, copy `TOOL_COPY_IT`, ricerca, Library categorie + filtro `Affidabilità`, badge `Verificato` solo per Gold / `In verifica` per gli altri) + batch Gold data-table/date-time/text-writing. Riparati 2 test obsoleti (`certification-index.test.ts` conteggi 50→99 + forgery su tool non-verificato + asserzioni nuove famiglie; `onboarding.test.ts` candidato `markdown-preview`→`archive-checksum-manifest`).
2. `3a89730`: ri-certificati **tutti i 99 Gold + 1 Partial** sulle sorgenti correnti (fingerprint+revision aggiornati, stale 100→0), rigenerata coppia `v1-gold-frontier.json` + `expanded-catalog-certification.json`.

## 5. Lavoro restante (in ordine)

- **P1 — certifica i 100 unverified, famiglia per famiglia** (priorità suggerita: `pdf` → `research-knowledge` → `file-privacy` → `image/image-visual` → `url-marketing` → resto). Per famiglia servono: fixture/oracle indipendenti, edge case deterministici, input malformati, contratti privacy/rete, copy risultati in italiano, acceptance browser dove serve (file, immagini, PDF, canvas, clipboard, download). Mai promuovere a Gold senza evidenza.
- **P2 — backend/d-discovery**: ranking ricerca per task/input/contesti, Profile default + handoff tipizzati tra tool compatibili, reference data italiane versionate, portabilità config, budget performance/lazy.
- **P3 — redesign UI** solo dopo backend stabile (home/Workbench/Library/mobile). Non lucidare l'attuale shell.
- **P4 — release**: validazione finale, deploy produzione + rollback-evidence, URL canonici, sitemap/robots, analytics/privacy. Sync/auth/monetizzazione solo su bisogno dimostrato.
- **Bloccanti noti (non forzarli)**: `image-resize` resta Partial senza device fisici; `release:validate` resta BLOCKED per: 100 missing (P1), 1 not-Gold (by-design), evidenza fisica (esterna), matrice browser (serve run 5 motori: chrome/edge/chromium/firefox/webkit — firefox/webkit/chromium richiedono download Playwright), `ROLLBACK_UNPROVEN` (pre-primo-deploy).

## 6. Contratto qualità / workflow (obbligatorio, nell'ordine)

```bash
npm test                  # catalog:build + certification:check + vitest (331 test)
npm run check             # + astro check (0 errori/warning/hint)
npm run build             # build statica 204 pagine + inspect (baseline bundle preservata)
npm run gold:sabotage     # guard fail-closed: deve restare PASS
npm run frontier:v1       # rigenera v1-gold-frontier.json (atteso: 14/15 BLOCKED su image-resize)
./node_modules/.bin/tsx scripts/build-certification-index.ts --check  # deve dire "output current"
./node_modules/.bin/tsx scripts/validate-release.ts --no-write-receipt  # sola lettura; BLOCKED atteso per §5
```

Regole critiche (violazione = tranche invalida):

1. **Certifica per ultimo, committa subito dopo**: il fingerprint evidenza copre `src/ scripts/ tests/ public/ quality/fixtures/ quality/oracles/` + root file. Qualsiasi edit dopo la certifica invalida i receipt (`GOLD_RECEIPT_SOURCE_STALE`).
2. **`frontier:v1` e `build-certification-index` viaggiano in coppia**: il primo riscrive `v1-gold-frontier.json`, il cui sha è incorporato nell'indice. Dopo `frontier:v1`, sempre rigenerare l'indice (altrimenti `certification:check` va stale).
3. **Mai badge `Verificato` senza `goldEligible` reale**; i tool non certificati restano `In verifica`.
4. **Italiano-first ovunque** (shell, onboarding, Workbench, form, risultati, errori via `src/i18n/it/errors.ts`); identificatori standard invariati (JSON, CSV, JWT, UUID, Open Graph, WebP…).
5. **Niente crescita catalogo oltre 200** se regressioni/costi/bundle crescono più del valore. Niente dipendenze server/LLM come percorso normale.
6. Test di frontiera in `tests/certification-index.test.ts`: se certifichi nuovi Gold, aggiorna i conteggi attesi + le asserzioni per-engine (e il forgery-test deve mirare a un tool con `certificationReceipt === null`).

## 7. Come certificare una NUOVA famiglia (ricetta)

1. Fixture: aggiungi famiglia in `quality/fixtures/index.json` + vettori in `quality/fixtures/<famiglia>-gold/` (usa come modello `data-table-gold/`), con `truth_sources` esistenti in `quality/oracles/sources.json` (oracle registry ha già 200 entry `cand-001…cand-200`, non ricrearle).
2. Script di certifica in `scripts/gold/<famiglia>-certify.ts` sul modello di `data-table-certify.ts`: esegue i motori contro i vettori, richiede `browser-acceptance.json` di famiglia a `PASS` se dichiari evidenza browser, scrive `quality/receipts/<famiglia>/*.gold.json` con `revision` + `sourceFingerprint` correnti (via `scripts/lib/current-revision.ts`). Aggiungi lo script npm in `package.json` (`gold:<famiglia>`).
3. Acceptance browser in `scripts/acceptance-<famiglia>.mjs` sul modello di `acceptance-data-table.mjs` (serve `dist/` buildato + Chrome di sistema in `/Applications/Google Chrome.app`; niente download Playwright per i test famiglia).
4. Cablaggio evidenza in `src/quality/certification.ts`: `toolEvidencePaths` (locality/mobileA11y/lazyLoad ed eventuale physicalDevice), `familyTestFiles` per i test di famiglia.
5. Test: estendi `tests/certification-index.test.ts` (conteggi + asserzione famiglia) e verifica che nessun altro test assuma lo status dei tool promossi (cerca l'id nei test, come successo per `markdown-preview` in `onboarding.test.ts`).
6. Sequenza finale: acceptance → gold → `frontier:v1` → rebuild indice → `npm test` → `npm run check` → commit immediato → push.

## 8. Pulizia / vecchi (regole per non fare danni)

Situazione verificata al 2026-10-01 — **nulla da cancellare**, non ricreare lavoro:
- Unica copia esistente: questo repo (verificato via `mdfind`, `find`, `git worktree list`, `.git/worktrees` assente, nessuno stash, solo branch `main` + `origin/main`).
- Orca: nessun workspace StrumentiUtili (`~/orca/workspaces`), `~/.worktrees/*` vuote e non collegate, `~/Worktrees/.orphan-backup` = materiale ChatGPT-gizmo non suo.
- Altri PC via SSH: minipc, matebooklinux, macbookair raggiungibili e **senza copie**; omarchy non risolvibile (riprova se serve).
- Prima di QUALSIASI cancellazione futura: riesegui le verifiche sopra, cancella solo target collegati a StrumentiUtili + già mergiati su `main` + zero consumer; mai toccare `~/Backups`, profili browser/auth, DB, repo altrui, history Git (niente rewrite/force-push).

## 9. Primi comandi per chi riprende

```bash
cd /Users/domenico/Code/StrumentiUtili.it && git pull --ff-only && git status --short --branch && git log --oneline -3
npm test 2>&1 | grep -E "Test Files|Tests "
./node_modules/.bin/tsx scripts/validate-release.ts --no-write-receipt 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'], d['counts'])"
```

File chiave: `src/tools/*/manifest.ts` (contratto Tool Factory), `src/generated/catalog.ts` (generato, gitignored), `src/quality/certification.ts`, `src/release/validation.ts`, `scripts/gold/*`, `scripts/acceptance-*.mjs`, `quality/receipts/`, `quality/fixtures/`, `quality/oracles/`.
