# TFR annuale — formule, fonti e limiti (STR-015 / issue #72)

Verifica: 22 ottobre 2026. Motore: `src/engines/italy/tfr-15.ts`.

## Ambito e calcoli

- **Quota lorda annua**: retribuzione utile effettiva dell'anno / 13,5, meno la riduzione IVS configurata tra 0 e 0,50% della retribuzione utile, se applicabile. Gli importi sono arrotondati al centesimo per anno. La retribuzione utile va accertata secondo art. 2120 c.c.; non coincide necessariamente con la RAL.
- **Rivalutazione annua**: `montante accantonato al 31/12 dell'anno precedente × (1,5% + 75% × max(0, variazione FOI dicembre/dicembre))`. La quota maturata nell'anno **non** si rivaluta nello stesso anno. In caso di variazione negativa si conserva il tasso fisso dell'1,5%. Il montante è capitalizzato ogni anno.
- **Input**: da 1 a 60 anni civili completi, consecutivi e già conclusi, a partire dal 1983. Gli importi sono in euro con massimo due decimali; la percentuale FOI può avere fino a dieci decimali per rispettare il rapporto tra indici pubblicati. Il primo FOI è ignorato. Un FOI necessario e assente rende il totale `PARTIAL`, senza sostituire un dato non verificato.

## Confronti storici verificabili

| Anno dicembre | FOI dicembre precedente → corrente | Variazione dicembre/dicembre | Coefficiente TFR annuo ufficiale |
|---|---|---|---|
| 2020 | 102,5 → 102,3 | -0,19512195% circa | 1,500000% |
| 2024 | 118,9 → 120,2 | +1,09335576% circa | 2,320017% |
| 2025 | 120,2 → 121,5 | +1,08153078% circa | 2,311148% |

Questi indici sono dati storici, **non un feed dinamico**. Per anni diversi l'utente deve verificare il FOI pertinente. Il calcolo usa la percentuale inserita dall'utente e non inventa indici.

## Fonti e provenienza

- [Normattiva, legge 29 maggio 1982 n. 297, art. 1, che sostituisce art. 2120 c.c.](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1982-05-29;297): divisione per 13,5, retribuzione utile e rivalutazione composta del montante precedente.
- [INPS, circolare 75/2024](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2024/06/Circolare_14611/Allegati/15195_Circolare-numero-75-del-28-06-2024.pdf): riduzione IVS dello 0,50% ed eccezioni da verificare caso per caso.
- [ISTAT, prezzi al consumo dicembre 2020](https://www.istat.it/comunicato-stampa/prezzi-al-consumo-dicembre-2020/) e [Assolombarda, prospetto TFR dicembre 2020](https://www.assolombarda.it/servizi/informazioni-economiche/trattamento-di-fine-rapporto-tfr-nota-informativa-dicembre-2020): FOI negativo ma rivalutazione 1,500000%; caso di regressione.
- [ANCE, TFR dicembre 2024](https://ance.it/2025/02/legge-29-maggio-1982-n-297-tfr-indice-istat-relativo-al-mese-di-dicembre-2024/): coefficiente ufficiale 2,320017% e dati FOI.
- [ISTAT, prezzi al consumo dicembre 2025](https://www.istat.it/comunicato-stampa/prezzi-al-consumo-dicembre-2025/) e [Confindustria, TFR dicembre 2025](https://www.confindustria.it/pubblicazioni/coefficienti-tfr-e-crediti-di-lavoro-dicembre-2025): coefficiente 2,311148% applicato al pregresso al 31/12/2024.
- [INPS, circolare 194/2014, §8.3](https://servizi2.inps.it/servizi/Bussola/VisualizzaDoc.aspx?Accessibile=yes&iIDLink=-1&sVirtualURL=%2FCircolari%2FCircolare+numero+194+del+30-12-2014.htm): rivalutazione e imposta sostitutiva, non inclusa nella stima lorda.

**Riuso e licenze**: il fix estende il motore TypeScript già presente nel repository e i componenti esistenti; nessun pacchetto esterno, codice di terzi o donor importato. I valori storici sono ricostruiti dai dati e dalle comunicazioni ufficiali citati sopra.

## Incertezze esplicite

La simulazione non tiene conto di periodi infrannuali, anticipazioni, trasferimenti al Fondo di Tesoreria/previdenza complementare, imposta sostitutiva sulla rivalutazione, tassazione separata effettiva né delle regole specifiche del contratto di lavoro. La stima fiscale nel tool `/tools/calcoli-fiscali-italia/` è indipendente e soltanto illustrativa: senza storia documentata restituisce `PARTIAL`. Nessun importo è un prospetto di liquidazione del datore di lavoro.

L'issue #72 resta aperta fino alla pubblicazione della release comune governata da #162 e #80 e alla verifica dell'URL di produzione, anche se il fix è stato testato e mergiato. PR e test locali non costituiscono prova del consumer pubblico.
