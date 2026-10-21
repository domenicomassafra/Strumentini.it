# Strumentini.it

## Prodotto e tracker

Strumentini.it è un workspace di utility web italiano-first e local-first.
Repo e issue: `https://github.com/domenicomassafra/strumentini-it`.
Checkout principale: `/Users/domenico/Code/Strumentini.it`.
GitHub Issues è il tracker corrente. `.scratch/strumentini-expansion-20261005/` è uno snapshot storico/operativo: consultalo solo quando l'issue corrente lo richiama e non creare ticket duplicati.

## Riuso prima di tutto (regola dell'owner, 15/10/2026)

Prima di scrivere codice per una funzione, cerca chi l'ha già fatto: repository GitHub/GitLab, pacchetti npm/PyPI/crates, issue e PR di altri progetti che risolvono lo stesso problema. Registra nella issue i candidati con link, licenza, ultimo rilascio e attività. Adotta il pacchetto, oppure forka/clona il repository e adattalo; scrivi codice proprio solo per la parte mancante e con il motivo scritto nella issue. Licenze: annota obblighi (MIT/Apache/BSD ok; LGPL/MPL/GPL/AGPL vanno segnalati all'orchestratore prima dell'adozione). Mantieni la provenienza (repo, commit, licenza) in un file di donor del progetto.

Registro donor esistente: [`docs/donor-provenance-366-active-2026-10-18.md`](docs/donor-provenance-366-active-2026-10-18.md).

## Architettura e ordine di lettura

1. Astro 7 + Preact + TypeScript generano il sito statico in `dist/`.
2. I tool sono dichiarati in `src/tools/**`; il Tool Factory genera catalogo e indici in `src/generated/**`.
3. I tool normali girano nel browser e mantengono file e risultati locali.
4. `quality/**` contiene fixture, oracle, ricevute e gate di certificazione.
5. `worker/**` è il backend Cloudflare opzionale per `/api/**`, auth e sync; il sito statico deve restare utilizzabile senza backend.

Leggi nell'ordine: issue GitHub e commenti → `README.md` → `PROJECT-STATUS.md` → `PRODUCT.md`/`PRODUCT-SPEC.md` se cambia il comportamento → `DESIGN.md`/`design/WORLD.md` se cambia la UI → sorgenti e test della superficie interessata. In `PROJECT-STATUS.md` il pannello live iniziale è corrente; le sezioni marcate come historical non lo sono.

## Comandi

Runtime: Node 26. Python 3 serve ai tool ticket/consumer ed è senza minor fissato; i test consumer usano anche `ffprobe`. Rust non è richiesto.

Setup di un checkout:

```sh
npm ci
npm ci --prefix spikes/heavy-local-feasibility --omit=dev
bash scripts/install-public-git-hooks.sh
```

Test mirati alla modifica, usando lo stesso selettore della CI PR:

```sh
npm run ci:scope -- --base="$(git merge-base HEAD origin/main)" --run
```

Build:

```sh
npm run build
```

Gate finale locale prima della consegna:

```sh
npm test -- --maxWorkers=1
npm run tickets:test
npm run check
npm run build
npm run deploy:check
```

`npm test`, `npm run check` e `npm run build` eseguono `catalog:build` e possono aggiornare file generati; rivedi sempre il diff dopo i gate. `npm run deploy:check` è un dry-run Cloudflare e non pubblica.

Deploy produzione, solo dopo merge e accettazione esplicita della release, da checkout pulito con `HEAD == origin/main`:

```sh
npm run deploy:production:guarded -- --expected-sha="$(git rev-parse origin/main)"
```

Il wrapper ripete test/check/build/dry-run, richiede release admission valida e solo allora esegue `wrangler deploy`; se una prova manca termina `NO_GO` prima della pubblicazione.

### Policy di rilascio owner 20/10/2026 (#162, #80)

L'owner ha sostituito il criterio di rilascio: «pubblica con test automatici verdi» — suite completa, prove browser e telefoni simulati verdi, rollback effettivamente provato; il telefono fisico è opzionale dopo la release, e per le lane mobili «basta simulatore ed emulatore». Il criterio vive in `src/release/owner-policy-420.ts` e governa il wrapper guarded: le prove per-tool Gold e i receipt di dispositivo fisico restano visibili come `WAIVED_OWNER_DECISION`, mai come PASS. Il profilo storico resta disponibile con `STRUMENTINI_RELEASE_STRICT=1`.

Evidenze richieste, tutte legate a revisione e impronta sorgente:

```sh
npm run build                     # dist su cui girano le lane mobili
npm run acceptance:browser-performance     # matrix chrome/chromium/firefox/webkit
npm run acceptance:android-chrome-avd:277  # emulatore Android + Chrome installato
npm run acceptance:ios-safari-sim          # simulatore iOS/WebKit su macOS
npm run release:rollback:420               # staging: deploy, rollback reale, ripristino
npm run release:gate:420                   # ammissione automatica
```

Un receipt non si corregge a mano: se manca una prova la release resta `NO_GO`. `EMULATOR`/`SIMULATOR` non diventano mai prova fisica.

## Consegna e installazione

Lavora da `origin/main` su un branch breve `feat/<ticket>` o `fix/<ticket>`; per sola documentazione va bene `docs/<ticket>`. Prima del push riallinea con `git pull --rebase origin main`, poi push del branch e PR verso `main`. La CI PR esegue i controlli scoped; merge solo con CI verde e criteri del ticket provati. Il pre-push locale blocca `origin/main`; non aggirarlo. Dopo il merge rileggi lo SHA remoto di `main` e verifica la CI cumulativa. La merge non fa deploy.

La produzione è Cloudflare Worker `strumentini` sul custom domain `strumentini.it`, con asset da `dist/`; `/api/**` usa il Worker e D1 `AUTH_DB`. Il deploy produzione è la fase separata descritta sopra.

## Non toccare

- Non modificare a mano file generati quando esiste il generatore sorgente.
- Non falsare o riscrivere a mano receipt, fingerprint, prove fisiche o stato Gold.
- Non usare preview, emulatori o fixture sintetiche come prova di dispositivo fisico o autenticità del formato.
- Non cambiare binding/risorse Cloudflare o D1 come effetto collaterale di un ticket applicativo.
- Non fare deploy produzione per chiudere una normale PR se la release non è esplicitamente richiesta e ammessa dai gate.
