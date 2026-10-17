# Strumentini.it

## Prodotto e tracker

Strumentini.it è un workspace di utility web italiano-first e local-first.
Repo e issue: `https://github.com/domenicomassafra/strumentini-it`.
Checkout principale: `/Users/domenico/Code/Strumentini.it`.
GitHub Issues è il tracker corrente. `.scratch/strumentini-expansion-20261005/` è uno snapshot storico/operativo: consultalo solo quando l'issue corrente lo richiama e non creare ticket duplicati.

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

## Consegna e installazione

Lavora da `origin/main` su un branch breve `feat/<ticket>` o `fix/<ticket>`; per sola documentazione va bene `docs/<ticket>`. Prima del push riallinea con `git pull --rebase origin main`, poi push del branch e PR verso `main`. La CI PR esegue i controlli scoped; merge solo con CI verde e criteri del ticket provati. Il pre-push locale blocca `origin/main`; non aggirarlo. Dopo il merge rileggi lo SHA remoto di `main` e verifica la CI cumulativa. La merge non fa deploy.

La produzione è Cloudflare Worker `strumentini` sul custom domain `strumentini.it`, con asset da `dist/`; `/api/**` usa il Worker e D1 `AUTH_DB`. Il deploy produzione è la fase separata descritta sopra.

## Non toccare

- Non modificare a mano file generati quando esiste il generatore sorgente.
- Non falsare o riscrivere a mano receipt, fingerprint, prove fisiche o stato Gold.
- Non usare preview, emulatori o fixture sintetiche come prova di dispositivo fisico o autenticità del formato.
- Non cambiare binding/risorse Cloudflare o D1 come effetto collaterale di un ticket applicativo.
- Non fare deploy produzione per chiudere una normale PR se la release non è esplicitamente richiesta e ammessa dai gate.
