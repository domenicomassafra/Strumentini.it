# Prove della rivalutazione indipendente

Il [rapporto](../AUDIT-INDIPENDENTE-STRUMENTINI-2026-10-10.md) interpreta queste prove. Non sono ricevute Gold e non modificano ticket, applicazione, database o produzione.

- `surfaces.json`: 104 navigazioni su 13 superfici, 320/390/768/1440 px, light/dark; status, errori JavaScript, testo, geometria e risorse del browser.
- `extra.json`: 26 navigazioni a 1024 px con reduced-motion, controllo account con campi sintetici e richieste non GET/HEAD bloccate, controllo recenti dopo risultato reale in contesto fresco.
- `flows.json`: quattro operazioni/output, errori, onboarding con salvataggio/reload e tema a 390/1440. Il selettore del primo controllo messaggio account era errato: il campo vuoto **non** prova assenza di messaggio; il controllo corretto è in `extra.json` e `auth-blocked-390.png`.
- `states.json`: PDF merge con 50 fixture e CPU throttling 8× per osservare loading/cancel; zero download dopo annullamento. Include CSS computato per testo secondario account: 13px, `rgb(124,138,158)` su bianco, contrasto calcolato 3,508:1. Non è dispositivo fisico né misura di prestazione normale.
- `pdf-independent-check.json`: PDF.js riapre i due download reali e verifica cinque pagine con testo/ordine.
- `390-*`/`1440-*`: output sintetici veri; i PNG sono confrontati per RGBA, CSV per celle quotate e zeri iniziali, URL per query/hash, PDF per pagine/testo. Nessun file personale.
- PNG selezionati e tavole: fotografie del sito esistente, non mockup del redesign. `*-full.png` mostra anche aiuto/footer.
- `catalog-review.csv`: tutti i 269 manifest con giudizio editoriale; `catalog-stats.json` conteggi e metodo. Non sono misure di popolarità o certificazioni individuali.
- `ticket-triage.md`: tutti i 43 originali, gate e proposte. Le issue originali restano autorità delle acceptance.
- `donor-*`: metadata GitHub autenticati senza credenziali, versioni/npm package sizes, WASM nel tarball. `pushed_at` non garantisce release stabile; unpacked bytes non sono payload web.
- `verification.json`: comandi finali read-only, esiti e blocker. L'email dell'autore del deployment è esclusa.
- `manifest.json`: baseline, momento di raccolta e hash degli artifact per controllare la consegna.

I quattro `.mjs` sono copie degli harness di raccolta, conservate come documentazione del metodo: usano i path di questa macchina, Playwright/Chrome già installati e `/tmp/strumentini-independent-audit` come destinazione. Per ripetere su un'altra macchina adattare i path e usare fixture sintetiche. Non installano librerie, non creano account né emettono ricevute canoniche. `flows.mjs` usa solo submit locale vuoto; `extra.mjs` impedisce richieste di scrittura nel retry account. Nessun browser state autenticato è esportato.

130 risposte 200 e assenza di overflow non provano tutte le operazioni, AA, dispositivi o domanda. Le lacune esatte e il modo di verificarle sono nella sezione 14 del rapporto. Lo snapshot non è un SLA della produzione futura.
