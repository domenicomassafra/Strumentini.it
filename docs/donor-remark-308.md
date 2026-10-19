# STR-308 — Decisione NO_GO sul donor remark/rehype (2026-10-19)

**Esito: NO_GO, parser Markdown→HTML esistente invariato.** Il confronto richiesto dall'issue [#308](https://github.com/domenicomassafra/strumentini-it/issues/308) è stato eseguito in un worktree isolato sulla base `origin/main` (`703d1dbb`); la prova di adozione è stata scartata dopo i gate sotto. Nessuna libreria del candidato è installata nel prodotto, nessun nuovo bundle viene distribuito, nessun deploy o stato Gold viene modificato. La direzione HTML→Markdown resta nel perimetro [#293](https://github.com/domenicomassafra/strumentini-it/issues/293); il gate diritti/asset [#126](https://github.com/domenicomassafra/strumentini-it/issues/126) resta indipendentemente aperto.

## Donor valutati e origine

Metadati npm registrati il 19 ottobre 2026. `gitHead` è il commit associato nei metadati npm, `integrity` è l'hash SRI SHA-512 nel lock temporaneo della prova, non un'autentica indipendente del tarball GitHub.

| Pacchetto | Repository upstream | Versione | gitHead | npm integrity |
| --- | --- | --- | --- | --- |
| `remark` | https://github.com/remarkjs/remark | 15.0.1 | `5017a27db024db6feec85a3e1e19f8d78a485680` | `sha512-Eht5w30ruCXgFmxVUSlNWQ9iiimq07URKeFS3hNc8cUWy1llX4KDWfyEDZRycMc+znsN9Ux5/tJ/BFdgdOwA3A==` |
| `remark-rehype` | https://github.com/remarkjs/remark-rehype | 11.1.2 | `b5a2e5bb0f14607b6fc79ccbfdf0d518a4f304de` | `sha512-Dh7l57ianaEoIpzbp0PC9UKAdCSVklD8E5Rpw7ETfbTl3FqcOOgq5q2LVDhgGCkaBv7p24JXikPdvhhmHvKMsw==` |
| `rehype-sanitize` | https://github.com/rehypejs/rehype-sanitize | 6.0.0 | `566a856d8b626c3d016f610048bdaf327464e467` | `sha512-CsnhKNsyI8Tub6L4sm5ZFsme4puGfc6pYylvXo1AeqaGbjOYyzNv3qZPwvs0oMJ39eryyeOdmxwUIo94IpEhqg==` |
| `rehype-stringify` | https://github.com/rehypejs/rehype | 10.0.1 | `c5aba0b50d84d970d71d83150b158047eeeaedc6` | `sha512-k9ecfXHmIPuFVI61B9DeLPN0qFHfawM6RsuX48hoqlaKSF61RskNjSm1lI8PhBEM0MRdLxVVm4WmTqJQccH9mA==` |

Ogni pacchetto diretto e tutti i **33 nuovi transitivi** risultavano **MIT** secondo `package-lock.json`. I notice/testi licenza sono nei pacchetti npm stessi; non sono emersi asset/font/WASM/model nuovi. La verifica esamina metadati e pacchetti installati temporaneamente, e non certifica diritti di redistribuzione né risolve #126. È stato scartato `remark-gfm`: abilita autolink e semantiche GFM non ammesse dal sottoinsieme già pubblicato.

## Prototipo e compatibilità

Il prototipo confinava la trasformazione a MD→HTML con `remark → remark-rehype → rehype-sanitize → rehype-stringify`, tag/attributi allowlisted, HTML raw preservato come testo escaped, link disabilitati tramite `safeHref` già in uso, `rel="noreferrer noopener"` e fallback per costrutti GFM/immagini/liste annidate. Le altre quattro direzioni e il risultato normalizzato restavano sul motore esistente; né upload né fetch erano introdotti. È stato testato mantenendo gli envelope d'errore e il controllo abort già esistente.

- **Fixture/test locali:** `tests/text-markup-conversion.test.ts`, `tests/text-writing-engine.test.ts` e cinque casi aggiuntivi ostili nel prototipo: **26/26 PASS**. I casi nuovi coprivano HTML raw, link `javascript:`/`file:`/protocol-relative, nessun fetch, fallback sintassi non supportata, determinismo e AbortSignal inizialmente annullato.
- **Differenziale:** 30 stringhe Markdown indipendenti, inclusi contenuti ostili: **29 output HTML identici**; un caso divergente favorevole al CommonMark (`a &amp; b` decodifica l'entità, mentre il parser corrente la raddoppia in `&amp;amp;`). Nessuna modifica semantica è stata distribuita.
- **Browser:** build del prototipo su Chromium headless **PASS** con input raw `<img onerror>` e link JavaScript: anteprima inattiva, nessun elemento attivo, richiesta outbound o errore JS. Su Firefox e WebKit Playwright 1.63.0 i processi browser non hanno completato l'handshake di avvio entro 25 s; prove **non disponibili**, quindi non sono dichiarate PASS. Nessuna prova fisica iOS/Android.

## Costi e motivo del NO_GO

Benchmark locale con Node `--import tsx`: moduli importati in processi distinti, 1.000 conversioni dello stesso Markdown (titolo, testo/strong/em, link, lista, blockquote e code fence), campionando `process.memoryUsage()` in ogni iterazione. I valori variano con il carico della macchina; queste sono misure indicative, non prestazioni di un dispositivo fisico.

| Motore | Import iniziale | Tempo 1.000 conversioni | Picco heap campionato | Picco RSS campionato |
| --- | ---: | ---: | ---: | ---: |
| Subset attuale | 5 ms | 372 ms | 10,2 MB | 70,1 MB |
| Donor remark/rehype | 734 ms | 3.902 ms | 22,8 MB | 101,2 MB |

Chunk Vite del prototipo: `text-markup-conversion.Cazwn60E.js` **167.553 byte minificati / 51.570 byte gzip**, caricato lazy dal runtime dello strumento; il JS iniziale di route nel build testato era **7.915 byte**. La prima versione prototipo con `remark-gfm` pesava **194.074 byte / 59.184 byte gzip**, poi rimossa. Il build statico di verifica completava **304 pagine** e `deploy:check` Cloudflare era dry-run PASS.

Il rendering Markdown elementare risulta circa **10,5 volte** più costoso nel benchmark, la memoria cresce e **due browser su tre** non hanno confermato il comportamento. Non è stato possibile dimostrare il beneficio netto richiesto per sostituire il parser di produzione; questa è la ragione concreta del **NO_GO** previsto dall'acceptance dell'issue, preservando l'implementazione attuale.

## Recupero futuro

Per riprendere l'adozione, rivalutare i quattro pin con licenze/SRI, eseguire i tre browser in un ambiente Playwright funzionante e su dispositivi fisici solo se il comportamento lo richiede, produrre una misura realistica di input piccoli/grandi e un limite di memoria accettabile. Integrare soltanto dopo prova di sicurezza/compatibilità e della performance giudicata sostenibile. Il rollback non è necessario in questa consegna perché il motore e tutte le dipendenze di produzione restano quelli precedenti.
