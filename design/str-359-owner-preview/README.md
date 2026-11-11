# STR-359 — Risorse, privacy ed errori: due proposte per la scelta owner

**11 novembre 2026 — proposta visuale, nessuna variante approvata.** La componente funzionale originaria di STR-359 (stati di attesa, elaborazione, annullamento, errore e successo) è già stata integrata nella [PR #548](https://github.com/domenicomassafra/Strumentini.it/pull/548). Il ticket [#120](https://github.com/domenicomassafra/Strumentini.it/issues/120) comprende ora il redesign dell'intero sito. La decisione owner dell'11 novembre autorizza la preparazione di **due proposte per Risorse, Privacy ed Errori** e relativi screenshot, con implementazione solo dopo la scelta. Il rilascio pubblico è disciplinato separatamente da [#162](https://github.com/domenicomassafra/Strumentini.it/issues/162).

Apri [index.html](index.html) per confrontare la stessa informazione in due organizzazioni visive. I parametri `variant=guide|path` e `view=resources|error` rendono riproducibile il confronto. Il pulsante degli stati alterna cinque esempi descrittivi. La preview non elabora file, non usa account, non invia richieste esterne, non salva preferenze e non offre download simulati.

## A — Guida chiara

Una pagina di servizio coerente con l'impianto visuale attuale: brand blu, navigazione laterale, introduzione breve, privacy e stati in card affiancate, percorso di ripresa in tre passi. La pagina 404 offre una spiegazione e due modi di tornare alla guida. È la variante con **minor costo di implementazione**: conserva la grammatica definita da [WORLD.md](../WORLD.md) e richiede soprattutto migliore gerarchia informativa.

## B — Percorso guidato

Una gerarchia più decisa: barra di navigazione in alto, introduzione verde scuro, stati di operazione prima della privacy, una lettura progressiva e forme editoriali più asciutte. La pagina 404 usa una segnaletica più evidente. È la variante con **maggior distanza visiva** dall'attuale UI; dopo la scelta richiede una decisione anche sulla convivenza con i token canonici del resto del sito.

Le due proposte mostrano i medesimi contenuti e non modificano `src/pages/`, `src/components/`, `design/WORLD.md` né le API. I testi dei casi demo non sostituiscono i messaggi runtime: il prodotto deve continuare a usare le traduzioni reali e i rifiuti implementati in #548. I dati locali sono distinti da account, preferiti sincronizzati e strumenti che richiedono richieste di rete; non si afferma che **ogni** funzionalità del sito lavori sempre offline.

## Immagini della build locale

| Variante | Risorse desktop | Risorse telefono | Errore desktop | Errore telefono |
|---|---|---|---|---|
| A | [Guida desktop](previews/guide-resources-desktop.png) | [Guida 390px](previews/guide-resources-mobile.png) | [404 desktop](previews/guide-error-desktop.png) | [404 390px](previews/guide-error-mobile.png) |
| B | [Percorso desktop](previews/path-resources-desktop.png) | [Percorso 390px](previews/path-resources-mobile.png) | [404 desktop](previews/path-error-desktop.png) | [404 390px](previews/path-error-mobile.png) |

La cartella `previews/` contiene screenshot **catturati da Chromium** sul build locale `dist/str-359-owner-preview` tramite il test seguente. Le immagini restano proposte, non prove di avvenuta integrazione prodotto o release.

## Verifica riproducibile

Dal worktree con Node 26 e dipendenze del progetto disponibili, sul Mac Studio con resource guard:

```sh
python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- npm run build
node scripts/build-str-359-owner-preview.mjs
python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- node tests/str-359-owner-preview.browser.mjs
```

Il browser copre 2 varianti × 2 pagine × 5 larghezze (320/390/768/1024/1440), navigazione e URL, stati annullato/errore/successo dichiaratamente demo, assenza di overflow, contrasto di campioni di testo almeno 4,5:1, focus visibile, zoom CSS simulato 200%, assenza di errori JavaScript o richieste esterne. Gli screenshot sono scattati alle larghezze 390 e 1440, a pagina intera. La verifica sul prototipo non equivale a un audit WCAG dell'applicazione finale, a zoom nativo del sistema, o a prove su dispositivi fisici.

**Decisione richiesta:** scegliere A o B, oppure indicare un adattamento concreto. Dopo la scelta l'autore di #120 potrà definire le modifiche nel prodotto completo, preservare privacy e accessibilità, testare gli stati reali, eseguire CI e consumer installato sullo SHA integrato. La scelta di queste due superfici non decide automaticamente il redesign del resto del sito.
