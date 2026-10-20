# STR-374 / #134 — Provenienza editor PDF (2026-10-20)

L'editor è un adattatore proprietario nel workspace PDF: nessuna modifica al sorgente dei donor.

| Donor | Versione/commit | Licenza | Hash e fonte |
| --- | --- | --- | --- |
| [mozilla/pdf.js](https://github.com/mozilla/pdf.js) | 6.4.299; [d0991a0d53f3bb3a7307e3b83f279c1d117aafb3](https://github.com/mozilla/pdf.js/commit/d0991a0d53f3bb3a7307e3b83f279c1d117aafb3), 03/10/2026 | Apache-2.0 | npm integrity sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g== |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1; [4beebbef7a261ed0be089bb1d63a5b6e28cc488a](https://github.com/Hopding/pdf-lib/commit/4beebbef7a261ed0be089bb1d63a5b6e28cc488a) | MIT | npm integrity sha512-V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw== |

package-lock.json SHA256: b326e380504138328cc84cc17c9e955afec073fb001fe2563748246a2d8601e1.
PDF.js worker (installazione identica su MiniPC) SHA256: 07ceb740d746e5d9012fcf9f27d5c7dea09f7d2f5e74f5c8109e5787551a2333.
Notices: conservare LICENSE e attribution distribuiti con pdfjs-dist; nessun asset o file vendor copiato nel repository.

API ufficiali PDF.js riusate: getDocument/getPage, viewport.convertToPdfPoint/convertToViewportPoint e getAnnotations. pdf-lib gestisce dizionari e appearance vector /Highlight, /Square, /Text nel PDF esportato. Le PR upstream [#22050](https://github.com/mozilla/pdf.js/pull/22050) (underline/strikeout/squiggly) e [#20227](https://github.com/mozilla/pdf.js/pull/20227) (eraser) sono aperte al 20 ottobre 2026. I componenti sperimentali legati al viewer completo non sono stati copiati perché la versione web offre API stabili di rendering/annotazione con minore costo d'integrazione.

Limiti: input 25 MiB, output 50 MiB, 200 pagine, 100 nuove annotazioni, 1000 caratteri per commento, immagine canvas max 960×1200; Worker di scrittura con timeout 60 s. L'editor si carica dopo attivazione volontaria; nessun upload. AcroForm, firme o permessi: rifiuto esplicito. Nessuna modifica del testo originale né cancellazione sicura. Output riaperto dal parser indipendente con geometria, rotazione e numero di annotazioni verificate.
