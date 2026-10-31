# Strumentini.it — istruzioni di repository

## Prodotto e architettura
Sito di utility web italian-first, local-first; tracker: https://github.com/domenicomassafra/Strumentini.it/issues. Gli accordi generali su agenti, Git, segreti e host sono in `~/.dstack/contracts/shared-root/AGENTS.md`: non duplicarli qui.

`business_area_uid: UNKNOWN` — nessun hub Strumentini.it con UID verificato in `~/Obsidian/04-areas/` al 27/10/2026. Il nome del repository e il brand pubblico non attribuiscono da soli un'identità business; risolvere il puntatore soltanto contro un hub canonico verificato, come richiesto da `~/.dstack/docs/business-context.md`.

- Astro 7, Preact, TypeScript e Node 26; sito statico generato in `dist/`.
- Strumenti e dichiarazioni: `src/tools/**`; generatori producono `src/generated/**` e il catalogo. Cambia le fonti, mai a mano il generato.
- Motori locali: `src/engines/**`; interfacce: `src/components/tools/**`; route: `src/pages/**`.
- Fixture, oracle, certificazione e receipt: `quality/**`, `tests/**` e `scripts/**`. Una receipt rimane legata al suo SHA e non si riscrive a mano.
- Backend opzionale Cloudflare: `worker/**` per `/api/**`, account e sync; il percorso statico locale deve funzionare senza backend.
- Provenienza donor: `docs/donor-provenance-366-active-2026-10-18.md` e documenti correlati. Prima di implementare cerca meccanismi esistenti e licenze.

## Fonti e confini
Prima leggi issue e commenti, poi `README.md`, `PROJECT-STATUS.md` (attenzione allo storico), specifiche di prodotto solo quando coinvolte. `design/WORLD.md` è l'autorità visuale; la scelta del redesign finale resta sospesa fino a decisione owner (#113). Non modificare stile/UI per ticket di pulizia.

Il sito pubblico è `https://strumentini.it`, target Cloudflare Worker `strumentini` con D1 `AUTH_DB`. Nessun cambio implicito a binding, database, credenziali o asset di release. Un test nel browser/simulatore non prova un dispositivo fisico. Le issue #80 e #162 governano il gate comune di release.

## Ambiente e comandi
Lavorare sul Mac Studio: creare il worktree per issue con `orca worktree create` sul repository registrato, da `origin/main` (per esempio `~/Code/.worktrees/Strumentini.it/strumentini-it-<issue>`). Verificare che `node --version` riporti `v26.*`; eseguire sul Mac Studio installazione, build, test e Playwright attraverso:
```sh
python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- <comando>
```
Il MiniPC serve per runtime Linux, servizi installati e verifiche mirate, secondo le istruzioni globali. Setup dei nuovi worktree: `orca.yaml` richiede Node 26 e pnpm 12.14.0 per importare i tre `package-lock.json` (che restano autoritativi) e installare dal suo store condiviso tramite resource guard; le configurazioni pnpm generate restano locali e ignorate da Git. Lo script `scripts/check-pnpm-worktree-523.mjs` controlla il virtual store locale, il volume condiviso e la risoluzione `buffer/` dopo l'installazione. La CI continua con `npm ci`. Il primo popolamento dello store è più lento; per lo spike heavy, usare lo stesso launcher con `npm ci --prefix spikes/heavy-local-feasibility --omit=dev`; installare gli hook con `bash scripts/install-public-git-hooks.sh`.

Controlli mirati: `npm run ci:scope -- --base="$(git merge-base HEAD origin/main)" --run`.
Gate integrato (sempre attraverso il launcher sopra): `npm test -- --maxWorkers=1`, `npm run check`, `npm run build`, `npm run deploy:check`. `check`/`test`/`build` possono rigenerare file: rivedi il diff. `deploy:check` è solo dry-run. Lo stato dei ticket è su GitHub; lo snapshot in `PROJECT-STATUS.md` è storico.

## Merge, consumer e pubblicazione
Il repository usa PR verso `main` con CI source scoped verde e review; il pre-push non permette il push diretto su main. Dopo il merge rileggi `origin/main` e la CI cumulativa, poi prova il consumer compilato; non dedurre dal merge che la produzione sia aggiornata.

Il deploy di produzione è separato e richiede release admission valida per il SHA esatto, suite completa, browser, Android Emulator, iOS Simulator e rollback staging realmente provato (decisione owner 20/10). Comandi, tramite launcher: `npm run acceptance:browser-performance`, `npm run acceptance:android-chrome-avd:277`, `npm run acceptance:ios-safari-sim`, `npm run release:rollback:420`, `npm run release:gate:420`. Solo con autorizzazione release: `npm run deploy:production:guarded -- --expected-sha="$(git rev-parse origin/main)"`. I gate e i rifiuti `NO_GO` documentati conservano i loro effetti; #506 coordina l'eventuale pubblicazione.

Usa GitHub Issues come verità del ticket, con `Parent / What to build / Acceptance criteria / Blocked by` e commento di prova al termine. Gesti personali e account confluiscono nell'unica issue «Prove personali Strumentini.it».
