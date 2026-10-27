# STR #295 — Firma PDF crittografica locale, donor e limiti

## Percorso installato

`node scripts/pdf-sign-local-295.mjs` è un consumer **Node locale, volontario**. Il browser e il Worker Cloudflare non importano questo modulo, non hanno endpoint di firma, non ricevono PDF, P12 o password, e la firma grafica `/tools/pdf-visual-signature/` resta indipendente (solo immagine visibile). Su MiniPC il comando è utilizzabile dopo un `npm ci` locale nel repository; non esiste un servizio condiviso, upload temporaneo o storage TTL da configurare. La funzione server con opt-in/TTL appartiene alla issue #112/STR-349 ed è rinviata.

Esempio interattivo in Bash locale, eseguito nella cartella del repo, con **documento e P12 già presenti sullo stesso host**:

```sh
read -rs PDF295_PASSPHRASE
printf %s "$PDF295_PASSPHRASE" | node scripts/pdf-sign-local-295.mjs \
  --input ./documento.pdf --p12 ./identita.p12 --output ./documento-firmato.pdf \
  --password-stdin --consent-local-signing
unset PDF295_PASSPHRASE
```

La conferma `--consent-local-signing` è obbligatoria: nessuna trasmissione, installazione di server, background job o costo ricorrente. La password è letta solo da stdin, mai da un argomento o file creato dall'app. Il P12 vive soltanto nel percorso scelto dall'utente, in memoria durante l'operazione e non viene copiato dal tool. Il PDF d'uscita viene creato ex novo (`wx`, permessi `0600`), senza sovrascrivere gli input. Il tool non conserva, registra o trasmette PDF, certificati, chiavi e password e restituisce solo codici d'esito. Per annullare l'operazione si elimina **manualmente la copia firmata**; non esistono server, queue o dati remoti da pulire. Una revoca del certificato, se richiesta, si gestisce presso l'autorità emittente e non invalida automaticamente tutte le firme nei lettori.

Vengono rifiutati con codice stabile i PDF già firmati, AcroForm, revisioni multiple, PDF cifrati/linearizzati o con funzioni attive, file non PDF, P12 inutilizzabili, password errate e placeholder troppo piccoli. L'originale rimane inalterato. L'implementazione supporta PDF semplici a singola revisione e P12 RSA; il donor `P12Signer` assume RSA. Il pacchetto crea un campo firma invisibile PKCS#7 detached `adbe.pkcs7.detached` con digest SHA-256. La verifica `openssl cms -verify -noverify` verifica la **firma matematica e l'integrità** contro i byte dichiarati in `/ByteRange`, senza attestare la fiducia nella CA. Non attribuire validità giuridica/eIDAS, PAdES, identità verificata o certificazione della catena senza una valutazione distinta.

## Provenienza del donor e delle dipendenze (19 ottobre 2026)

**Fonte upstream:** [`vbuch/node-signpdf`](https://github.com/vbuch/node-signpdf), tag `v3.3.0`, commit `e74b26bb945bc111c3a7638c0760547c75b7acd7`, release 2025-12-29, MIT. Reuse diretto dei pacchetti signer/placeholder; codice proprio limitato a opt-in, preflight di revisione e firme preesistenti, I/O atomico, CLI e prove OpenSSL. `pdf-lib` ([upstream](https://github.com/Hopding/pdf-lib)) fornisce i tipi/documenti del placeholder, non viene implementato un writer PDF proprio. I tarball elencati sono gli URL bloccati da `package-lock.json`; il digest è l'integrità **SHA-512** del tarball npm, non l'hash dei file estratti.

| Pacchetto/versione | Licenza | Tarball npm (`resolved`) | Digest SHA-512 (`integrity`) |
|---|---|---|---|
| `@signpdf/signpdf@3.3.0` | MIT | `@signpdf/signpdf/-/signpdf-3.3.0.tgz` | `/vy3dPTsTbLHdsKRarPQw8++UqN8GXxjEVnl4ZRl+o/zMWFqVb861RM5bxoRMGGMuPSvb1Rgt2lmVobEc0YUpw==` |
| `@signpdf/signer-p12@3.3.0` | MIT | `@signpdf/signer-p12/-/signer-p12-3.3.0.tgz` | `MLynYKgUBu29ojIueIDV34sIOFDFpP0s1gQORxCc0zhs1jfy0juqU2xQpjUayMbhzB4L0zS9dPwgHtok1f89Cg==` |
| `@signpdf/placeholder-pdf-lib@3.3.0` | MIT | `@signpdf/placeholder-pdf-lib/-/placeholder-pdf-lib-3.3.0.tgz` | `DT1s617z88NvvCmo+z8jaz7lNzy7b7/fwo/movJGukpfSkl4FaLNRXIHNBCTRCP9TUb6F/axK1JulES/jY7mLQ==` |
| `@signpdf/utils@3.3.0` | MIT | `@signpdf/utils/-/utils-3.3.0.tgz` | `ArOP0MIhCfdChh1oZkog81TPeSY2e5TvHQmXJ682T4+SKb6Z609uAZhqMQZ9xm+YenEf/eNMSE5KVwU+EudXug==` |
| `pdf-lib@1.17.1` | MIT | `pdf-lib/-/pdf-lib-1.17.1.tgz` | `V/mpyJAoTsN4cnP31vc0wfNA1+p20evqqnap0KLoRUN0Yk/p3wN52DOEsL4oBFcLdb76hlpKPtzJIgo67j/XLw==` |
| `node-forge@1.4.1` | BSD-3-Clause **scelto** dalla doppia licenza BSD-3-Clause OR GPL-2.0 | `node-forge/-/node-forge-1.4.1.tgz` | `w5/MfWaeMrpR/5ba6fZyAUTLSuE6aYz7H/3cYrqwZEmf5eQS3IaaLgJt4MBv7HglGFWmV22K8h4U18RJQmw/ow==` |
| `@pdf-lib/standard-fonts@1.0.0` | MIT | `@pdf-lib/standard-fonts/-/standard-fonts-1.0.0.tgz` | `hU30BK9IUN/su0Mn9VdlVKsWBS6GyhVfqjwl1FjZN4TxP6cCw0jP2w7V3Hf5uX7M0AZJ16vey9yE0ny7Sa59ZA==` |
| `@pdf-lib/upng@1.0.1` | MIT | `@pdf-lib/upng/-/upng-1.0.1.tgz` | `dQK2FUMQtowVP00mtIksrlZhdFXQZPC+taih1q4CvPZ5vqdxR/LKBaFg0oAfzd1GlHZXXSPdQfzQnt+ViGvEIQ==` |
| `pako@1.0.11` | MIT AND Zlib | `pako/-/pako-1.0.11.tgz` | `4hLB8Py4zZce5s4yd9XzopqwVv/yGNhV1Bl8NTmCq1763HeK2+EwVTv+leGeL13Dnh2wfbqowVPXCIO0z4taYw==` |
| `pdf-lib/node_modules/tslib@1.14.1` | 0BSD | `tslib/-/tslib-1.14.1.tgz` | `Xni35NKzjgMrwevysHTCArtLDpPvye8zV/0E4EyYn43P7/7qvQwPh9BGkHewbMulVntbigmcT7rdX3BNo9wRJg==` |
| `tslib@2.8.1` | 0BSD | `tslib/-/tslib-2.8.1.tgz` | `oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==` |

Prefisso dei tarball: `https://registry.npmjs.org/`. Ove una dipendenza sia installata annidata, il lockfile resta l'autorità per versione, URL e digest. File `LICENSE` forniti dai tarball npm rimangono nei rispettivi pacchetti; eventuali NOTICE/attribuzioni richiesti dalle dipendenze restano da includere in un'eventuale distribuzione standalone. Nessuna redistribuzione di tarball o binario avviene con questa CLI. È stata scelta l'alternativa BSD di `node-forge`, senza adottare il ramo GPL.

**Aggiornamento sicurezza del 27 ottobre 2026 (#495):** `node-forge@1.4.1` corregge [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), presente nella precedente `1.4.0` e nella catena transitiva di `@signpdf/signer-p12`. La scelta BSD-3-Clause rimane invariata e il file `LICENSE` del tarball resta disponibile con l'installazione npm. Il percorso locale accetta solo P12 dell'utente e non verifica catene di fiducia: non attesta identità, validità legale o autorizzazione a esporre il donor come servizio multiutente. Nessun deploy pubblico è autorizzato dal presente ticket.

## Gate provato

`npx vitest run tests/pdf-cryptographic-signature-295.test.ts tests/pdf-visual-signature-241.test.ts --maxWorkers=1` prova un certificato RSA di test creato da OpenSSL in una directory temporanea ignorata, verifica detached con OpenSSL indipendente, rifiuta un byte alterato e i casi negativi, invoca il consumer Node **reale** come processo separato e testa la firma grafica preesistente. Il test elimina il certificato e la chiave fittizi a fine esecuzione.
