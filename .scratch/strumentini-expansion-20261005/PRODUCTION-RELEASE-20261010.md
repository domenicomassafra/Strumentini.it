# Strumentini.it — produzione 2026-10-10, rilascio verificato e rollback

## Codice effettivamente pubblicato

- Repository: `domenicomassafra/strumentini-it`, `main` sorgente esatto `b8d282ddbbb67e716ea48ffe741a0ec024c6be47` (lettura indipendente SHA GitHub locale/remoto uguali, divergenza `0 0` prima dell'upload).
- Worker Cloudflare: `strumentini`, custom domain `https://strumentini.it`, nuova versione **`81566048-77d0-4567-8602-049b8e42e589`**, tag `git-b8d282d`.
- Versione di rollback *precedente, realmente attiva prima del rilascio*: **`7e974054-1e52-4b1b-a41e-daadeece0232`** (`git-2af6e8c`). Registro Cloudflare precedente con rollback/restore effettivamente esercitati il 2026-10-07; **nessun rollback della nuova versione è stato eseguito**, e non lo si può dichiarare testato.
- Solo asset statici e client source aggiornati: `worker/**`, `wrangler.jsonc`, migrazioni D1/autenticazione non modificati rispetto all'ultima versione in produzione. D1 `AUTH_DB`, ASSETS e TURNSTILE_SECRET presenti sulla versione candidata. Nessuna migrazione/database mutation, nessun nuovo Gold.

## Gate realmente eseguiti sull'esatto HEAD `b8d282d`

- Checkout QA isolato `/Users/domenico/Code/Strumentini-prime-cleanqa-20261009`, unico untracked link `node_modules`, non i 3 WIP immagine su main.
- `npm run check`: **1877 file, 0 errori, 0 warning, 21 hint**.
- `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **211/211 suite, 1674/1674 test PASS**.
- `npm run build`: **290 pagine**, controllo inventario PASS, **651 asset JS**, 7.144 byte JS route iniziale. `dist/tools/pdf-secure-redaction/` e `dist/tools/pdf-visual-signature/` rigorosamente assenti.
- `npm run deploy:check`: portabilità **1617 file PASS**; `wrangler deploy --dry-run` **PASS**, binding AUTH_DB e ASSETS veri.
- `node scripts/build-anpr-historical-115.mjs --check`: **19.352 righe, SHA256 esatto PASS**.
- Validatore release completo: **0 errori strutturali, 8 BLOCKER ancora aperti** (ricevute Gold/source-bound, browser source-bound, fisiche iOS/Android, rollback current-source non verificato, link `node_modules` untracked nel worktree QA). Status `BLOCKED`, **NON dichiarare release certificata Gold, né alterare questi blocker**. La pubblicazione è stata una distribuzione manuale autorizzata dall'utente, verificata sugli invarianti critici ed effettuata gradualmente; non corrisponde al superamento della certificazione completa.

## Cloudflare upload, canary e produzione

1. `wrangler versions upload --strict --tag git-b8d282d --preview-alias goal-b8d282d`: nuova versione `81566048-77d0-4567-8602-049b8e42e589`; **1.197 asset caricati**, 420 già presenti. Non ha modificato il traffico live.
2. Preview separata `wrangler preview` **non effettuata**: Cloudflare ha richiesto un binding D1 preview distinto. Non è stato sostituito il placeholder con il database di produzione.
3. `wrangler versions deploy 7e974054-1e52-4b1b-a41e-daadeece0232@90 81566048-77d0-4567-8602-049b8e42e589@10 --name strumentini --yes`: **successo**, reale 90/10. Campionamento 40 GET su Codice Fiscale: **9 risposte 200 / 31 risposte 404**, coherent with rollout. Tutte le altre route essenziali PASS, `GET /api/auth/session` restituisce `{"user":null}`.
4. `wrangler versions deploy 81566048-77d0-4567-8602-049b8e42e589@100 --name strumentini --yes`: **successo**, `wrangler deployments status` ha confermato esattamente **100%** nuova versione.
5. Controllo produzione reale `https://strumentini.it`: GET homepage, `/strumenti/`, `/tools/pdf-compression-lite/`, `/tools/pdf-split/`, `/sitemap.xml`, `/robots.txt`, `/api/auth/session` **200**; `/tools/pdf-secure-redaction/` e `/tools/pdf-visual-signature/` **404**; `/tools/codice-fiscale/` **12/12 richieste 200 con `noindex, nofollow` e marker canonico**, assente dalla sitemap.
6. **Chromium headless vero sul dominio di produzione**, viewport 390x844: `CF08_TEST_BASE_URL=https://strumentini.it node tests/codice-fiscale-public-08.browser.mjs` **10/10 gruppi PASS**, generazione source-bound, validazione e decodifica, omocodia, clipboard, download `.txt`, rifiuti della geografia non provata, zero upload/PII su rete, zero eccezioni/overflow.

## Rollback operativo se compare una regressione reale

Comando: `npx wrangler rollback 7e974054-1e52-4b1b-a41e-daadeece0232 --name strumentini --message "Restore proven previous Strumentini.it git 2af6e8c" --yes`.

Dopo l'eventuale rollback **verificare** `wrangler deployments status --name strumentini` e GET homepage, catalogo, `/api/auth/session`; non segnare come eseguito prima di averlo davvero fatto.

## Stato ticket, rischi, ownership

- Dashboard rimasta verificata **327 totali / 262 conclusi / 65 aperti**, nessuna chiusura fittizia. #115 ANPR aggiunge intervalli fino al repository 2023 ma non copre tutti i comuni/stati esteri; #117 forfettario 2025 include le 9 righe ufficiali ma non un pack IVA/INPS completo. #218/#219/#249 hanno motori e UI testati, non certificazione universale o prove smartphone.
- Tre file sporchi preesistenti `src/components/tools/image-visual/{ImageResultV2,ImageVisualTool}.tsx` e `src/engines/image/visual-tools.ts` **non stage, non commit, non deploy**; preservati per writer concorrente.
- La presente documentazione può essere committata *dopo* il rilascio; in tal caso GitHub `main` andrà avanti con commit solo documentali, ma la versione Worker taggata continuerà a riferirsi al sorgente esatto `b8d282d`.
