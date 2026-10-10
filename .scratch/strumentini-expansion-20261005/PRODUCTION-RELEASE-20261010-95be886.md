# Strumentini.it — produzione intermedia 2026-10-10, `95be886`

**Autorità reale:** Cloudflare Worker `strumentini`, custom domain `https://strumentini.it/`. Versione distribuita al **100%**: `6a1a5eaf-1091-45a7-a7c8-635c321877be`, tag `git-95be886`. Versione che serviva il 100% del traffico prima del rilascio: `32956b26-6c3c-4a22-92c5-ae29be8e7f65`, tag `git-a25dbf1`. La presente è una **distribuzione manuale autorizzata**, NON una promozione a Gold di ogni strumento.

## Sorgente e prove antecedenti alla distribuzione

- Commit sorgente `95be88659af86d31508fbc5990c3ae2e3d0e1174` (`main` e `origin/main` uguali). Solo modifiche engine/UX/browser test/source notes; worker/auth/migrations D1 non modificati. Nessun file sorgente sporco al momento del deploy.
- `npm run check`: **1.949 file; 0 errori, 0 warning, 22 hint**.
- `npm run build`: **291 pagine**, 680 asset JS; `inspect-build PASS`, **269 tool** catalogati, 284 sitemap entries. `dist/tools/pdf-true-redaction-237/index.html` e `dist/tools/pdf-scansionato-ocr-247/index.html` **assenti**, route DEV-only.
- `npm test -- --maxWorkers=2 --fileParallelism=false --testTimeout=120000`: **233/233 suite, 1.791/1.791 test PASS**. Run finale sullo stato sorgente completo, prima del solo commit documentale di rilascio.
- `npm run deploy:check`: **portable static 1.693 file PASS**, Cloudflare `wrangler deploy --dry-run` PASS su **1.990 asset**, binding `AUTH_DB` D1 e `ASSETS` dichiarati. Nessuna nuova migrazione D1 e nessuna credenziale stampata.
- `npx tsx scripts/validate-release.ts --no-write-receipt`: **`BLOCKED`, 0 errori strutturali e 7 blocker**: browser evidence origin SHA precedente, 10 tool senza receipt, 2 non Gold, 259 Gold con fingerprint sorgente precedente, hardware Android/iOS mancanti, rollback receipt di altra revisione. **Non modificare gli stati per ottenere falsi PASS.**

## Cloudflare upload, canary, promozione

1. `wrangler versions upload --strict --tag git-95be886 --preview-alias interim-95be886`: **PASS**: 846 asset nuovi, 847 riutilizzati; Worker versione `6a1a5eaf-1091-45a7-a7c8-635c321877be`, D1 e ASSETS rilevati. L'upload non aveva cambiato il traffico pubblico.
2. `wrangler deployments status --name strumentini --json`: 100% su `32956b26-6c3c-4a22-92c5-ae29be8e7f65` (`a25dbf1`) prima del rollout.
3. `wrangler versions deploy 32956b26-6c3c-4a22-92c5-ae29be8e7f65@90 6a1a5eaf-1091-45a7-a7c8-635c321877be@10 --name strumentini --yes`: **PASS** 90/10, status Cloudflare confermato.
4. Durante il canary: **144/144 richieste HTTPS** dirette a nove route (16 per route) PASS: `/`, `/strumenti/`, `/tools/image-compression/`, `/tools/pdf-watermark/`, `/tools/pdf-text-extraction/`, `/tools/video-inspector/`, `/api/auth/session` tutte HTTP 200; API restituisce `{"user":null}` anonimo; PDF `pdf-true-redaction-237` e `pdf-scansionato-ocr-247` entrambe HTTP 404 intenzionali. Sono stati osservati due differenti byte-size per la route compressione immagini, coerente con le due versioni nel campionamento; questo **non** è un test statistico di rollback o prestazioni.
5. `wrangler versions deploy 6a1a5eaf-1091-45a7-a7c8-635c321877be@100 --name strumentini --yes`: **PASS**. `wrangler deployments status --json`: unica versione sopra al **100%**.
6. **Test nel dominio LIVE dopo promozione**: Playwright Chromium e WebKit desktop a viewport 390×844 sulla route vera `/tools/image-compression/`. Opt-in palette-exact, caricamento PNG RGBA locale, pressione di `Esegui in locale`, download `live-palette-exact.png`, **Sharp indipendente RGBA + alpha identico** per ogni pixel, zero errori JS, nessun overflow orizzontale, entrambi PASS. Il file 12.437 byte è diventato 192 byte nel corpus volutamente non compresso: **non è un rapporto garantito per dati reali**.

## Limitazioni / ritorno alla precedente versione

- Questa verifica **non** equivale a Gold completo né a prova hardware iOS Safari/Android Chrome. Ticket originale #047 ha soltanto criterio PNG concluso; #056/#212/#237/#246 e le rispettive dipendenze restano aperti.
- UI di oscuramento sicuro `#237` e OCR PDF `#247` **non pubblicate**. Il writer #237 è stato controllato con prove indipendenti, ma non approvato per input arbitrari o dispositivi fisici.
- Se compare regressione: rileggere **prima** `wrangler deployments status --name strumentini`; verificare che l'attuale produzione sia la versione qui nominata e che la versione precedente esista ancora. Poi, se appropriato, usare **`wrangler versions deploy 32956b26-6c3c-4a22-92c5-ae29be8e7f65@100 --name strumentini --yes`** per tornare al precedente Worker e ripetere HTTP smoke homepage, catalogo, `/api/auth/session`, compressione immagini, 404 dev. **Il rollback non è stato eseguito oggi**, quindi non inventare una receipt di restore/rollback su questa nuova versione.
- Nessuna modifica a D1, credenziali, configurazione custom domain o DNS; endpoint worker/auth già preesistente. `main` potrà avanzare **solo per documentazione** dopo il presente commit, mentre il Worker resta taggato `git-95be886`.

## Bonifica storica Git

- Inventario su sessione corrente: **14 worktree datati 2026-10-09**, tutti senza modifiche tracked. Le sole aggiunte non tracciate erano link simbolici al `node_modules` canonico, una piccola cache `.vitest/` e un vecchio script `.worker4-preserved.txt` di 10.045 byte sostituito da versione canonica più completa di 19.838 byte su `main`; SHA256 del testo superato `4c9521d7136b1890497940038cf63b0b416a15c3ebb8ae0e2a1101cdadf467c7`.
- Rimossi **14 worktree** tramite `git worktree remove` dopo la pulizia dei soli symlink/cache/script superati; rimossi **16 branch locali** storici `prime/`, `sprint/`, `worker/`, `feature/` dopo verifica file per file che il codice rilevante era già in main o era superato da nuove versioni. **Non usati** `git merge -s ours`, force push, reset distruttivi, né cancellati sorgenti canonici.
- Stato atteso: `git worktree list` una sola riga (`/Users/domenico/Code/Strumentini.it`); `git branch` solo `main`; `git ls-remote --heads origin` solo `main` (verificato); `git status -sb` pulito. Gli SHA storici citati nell'handoff restano prova della provenienza, ma i branch relativi non sono più working trees attivi. Non riprenderli automaticamente.

## Handoff successivo

Leggere `docs/HANDOFF-2026-10-10-RELEASE-INTERMEDIA.md` e `docs/PENDING-GRILLING-2026-10-10.md`. Sono i documenti **vivi** per la revisione prodotto; i `MEGA-HANDOFF-*2026-10-09*` in `.scratch` e i report di deploy precedenti restano **solo storico/audit**, non piani attuali. Non aggiungere altro WIP prima del grilling.
