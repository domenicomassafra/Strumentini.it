# STR-405 — anteprima, ammissione e rollback

Il percorso di produzione è `npm run deploy:production:guarded -- --expected-sha=<SHA completo di origin/main>`, da checkout pulito. Il wrapper esegue test, check, build, dry-run, ammissione cumulativa e il controllo `verify-release-scope-405.ts --all` prima dell'unico deploy. Tutti i tool sono nello scope perché il deploy pubblica l'intero `dist/`. Prove mancanti o obsolete, incluso il canary con rollback, devono produrre NO_GO: l'approvazione dell'owner non sostituisce le prove.

## Anteprima isolata esistente

Usare `npm run staging:deploy:328`. Il publisher verifica Worker, D1, routes vuote, origine e chiave pubblica Turnstile staging; non cambia il dominio di produzione e non applica migrazioni. Non copiare configurazione o segreti di produzione.

Prima del deploy registrare la versione precedente con:

	npx wrangler deployments status --config worker/wrangler.staging.jsonc

Dopo il deploy annotare SHA, versione candidata e data. Confrontare hash SHA-256 delle pagine servite con quelle costruite e provare le funzioni in Chrome automation-browser sul MiniPC. Le risposte HTTP da sole non provano le interazioni.

## Rollback e ripristino dell'anteprima

Riutilizzare il comando nativo Cloudflare, specificando sempre la configurazione isolata:

	npx wrangler rollback <VERSIONE_PRECEDENTE> --config worker/wrangler.staging.jsonc --message "STR-405 preview rollback"

Verificare versione attiva e hash identici a quelli registrati prima del deploy. Poi ripristinare la candidata con lo stesso comando e il suo ID; verificare nuovamente versione, hash e comportamento. Non cambiare D1: il rollback Worker non ripristina il database. Interrompere se le risorse/binding non sono compatibili.

Registrare gli esiti osservati nel commento della issue: sorgente/data, versioni, comandi, hash prima/candidata/rollback/ripristino, test browser e casi non eseguiti. Le simulazioni locali restano LOCAL_FIXTURE_ONLY. Una prova staging non diventa una receipt di produzione o una prova fisica e non autorizza a riscrivere i Gold.

## Produzione

Nessun deploy automatico dal merge. Preparare nella issue il comando guarded con SHA esatto e la riga `OWNER: ok alla pubblicazione in produzione di <SHA>`. Attendere l'approvazione esplicita e tutti i gate; se il main cambia servono nuove prove per quella sorgente. Non aggirare NO_GO con Wrangler diretto.

Fonti riusate: `scripts/deploy-staging-328.ts`, `scripts/prepublish-404.ts`, `scripts/verify-release-scope-405.ts` e [rollback nativo Cloudflare](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).
