# STR-423 / #176 — estrazione P7M/CMS: provenienza, riuso e limiti (21 ottobre 2026)

Ambito approvato dall'owner il 20/10/2026: **solo estrazione** del contenuto P7M/CMS con avviso esplicito e sempre visibile che la firma NON è verificata. Nessuna dichiarazione di autenticità, certificazione legale o validità eIDAS. La issue #126 (licenze e provenance donor) resta aperta: qui non è stato aggiunto nessun donor nuovo, quindi non serve una nuova clearance.

## Riuso valutato prima di scrivere codice

- [node-forge 1.4.0](https://www.npmjs.com/package/node-forge), già in `dependencies` (`1.4.0`, licenza dichiarata `BSD-3-Clause OR GPL-2.0`), non usato in `src/`. Provato il 21/10 sul corpus sintetico: `forge.pkcs7.messageFromAsn1` riconosce l'OID `1.2.840.113549.1.7.2` ma restituisce `signers: []` e `content` come accessor con `rawCapture`, cioè non è un estrattore bounded e non modella gli attributi CAdES. **Non adottato.**
- [PKIjs 3.4.0](https://www.npmjs.com/package/pkijs), **BSD-3-Clause**: possibile donor per una futura verifica completa del profilo CAdES. Non adottato: richiederebbe una nuova dipendenza e un audit di licenza/provenance (dipendenza #126) per una funzione che l'ambito approvato non include.
- [OpenSSL 3.5.5](https://docs.openssl.org/3.5/man1/openssl-cms/), **Apache-2.0**, usato **solo** per costruire e verificare il corpus sintetico sul MiniPC (nessun ruolo a runtime nel browser).
- Specifica primaria: [RFC 5652 §5](https://datatracker.ietf.org/doc/html/rfc5652#section-5) (CMS SignedData e `encapContentInfo.eContent`), letta il 21/10/2026.

Il lettore DER bounded in `src/engines/p7m/reader-176.ts` (~350 righe, nessuna dipendenza nuova) è il gap minimo: legge solo `ContentInfo → SignedData → encapContentInfo → eContent` e rifiuta tutto il resto. Nessuna licenza LGPL/MPL/GPL/AGPL è stata introdotta.

## Comportamento e limiti

- L'estrazione restituisce sempre `signatureVerification: "NOT_VERIFIED"` e il testo «Contenuto estratto; firma NON verificata, documento NON autenticato». Il contenuto può essere leggibile anche quando la firma è rotta: è il rischio centrale di AC-423.2.
- Limiti locali: file fino a 16 MiB, contenuto fino a 16 MiB, profondità DER 12, 1.024 nodi, 128 certificati. Solo lunghezza definita (DER); un BER a lunghezza indefinita viene rifiutato con codice esplicito, non interpretato.
- Rifiuti espliciti: firma detached senza `eContent` (`P7M_DETACHED`), busta troncata, OID diverso da SignedData, PEM non valido, input vuoto o oltre il limite.
- Nessuna rete: il test sostituisce `fetch` con una spia e verifica zero chiamate. Nessun contenuto viene eseguito, interpretato o mostrato come HTML.
- Non è una verifica: digest, signed attributes, firma, catena, CRL/OCSP, marca temporale e qualificazione eIDAS restano **NOT_RUN**. Un P7M reale di una CA italiana non è stato provato.

## Corpus e prove

`quality/fixtures/p7m-cms-176/` contiene buste CMS sintetiche (PDF, XML, PEM, detached, manomessa, troncata, BER indefinito, non-firma) generate con OpenSSL sul MiniPC il 21/10/2026, con `cert.pem` pubblico del firmatario sintetico e nessuna chiave privata. Le prove eseguite sono in `tests/regroom-str-176.test.ts`, `scripts/acceptance-p7m-176.mjs` e nel commento di consegna della issue. Il corpus sintetico non attribuisce Gold, non prova P7M reali e non sostituisce una validazione legale.
