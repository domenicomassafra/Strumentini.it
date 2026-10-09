function normalizedErrorText(value: unknown): string {
  if (value instanceof Error) return value.message.trim();
  return typeof value === "string" ? value.trim() : "";
}

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ABORT|CANCEL/u, "Operazione annullata. Nessun risultato è stato prodotto."],
  [/FILE_TOO_LARGE|PDF_LIMIT.*(?:BYTE|SIZE)|INPUT_TOO_LARGE/u, "Il contenuto supera il limite locale previsto da questo strumento. Riduci la dimensione e riprova."],
  [/TOO_MANY_FILES/u, "Hai selezionato troppi file. Riduci la selezione e riprova."],
  [/TABLE_TOO_MANY_COLUMNS/u, "La tabella contiene troppe colonne per essere elaborata in sicurezza nel browser."],
  [/TABLE_TOO_MANY_ROWS|TABLE_RESULT_TOO_LARGE/u, "La tabella contiene troppe righe o produrrebbe un risultato troppo grande. Riduci i dati e riprova."],
  [/TABLE_TOO_MANY_CELLS|TABLE_INPUT_TOO_LARGE/u, "La tabella è troppo grande per questo strumento. Riduci righe o colonne e riprova."],
  [/INVALID_(?:DATE|INSTANT)|DATE.*INVALID/u, "Inserisci una data valida nel formato richiesto."],
  [/INVALID_TIMEZONE/u, "Inserisci un fuso orario valido, per esempio Europe/Rome."],
  [/INVALID_(?:TIME|LOCAL_TIME)/u, "Inserisci un orario valido e controlla il fuso orario selezionato."],
  [/INVALID_YEAR/u, "Inserisci un anno valido: questo strumento copre dal 1900 al 2100."],
  [/INVALID_COUNTRY/u, "Scegli un Paese supportato da questo strumento: Italia, Stati Uniti, Canada o Regno Unito."],
  [/INVALID_WORDS_PER_MINUTE/u, "Scegli una velocità di lettura compresa tra 1 e 2000 parole al minuto."],
  [/INVALID_SAMPLE_TYPE/u, "Scegli un tipo di dati di esempio valido: parole, frasi, paragrafi, nomi, email, numeri o righe."],
  [/INVALID_QUOTE_DIRECTION/u, "Scegli una direzione di conversione valida: da dritte a tipografiche oppure da tipografiche a dritte."],
  [/INVALID_(?:DECIMAL|NUMBER|NUMERIC_VALUE|DENOMINATOR|RATE|PERCENT|COUNT|SEED)/u, "Controlla i valori numerici inseriti e riprova."],
  [/INVALID_(?:JSON|JSON_INPUT)|JSON_ARRAY_REQUIRED|JSON_OBJECT_ROWS_REQUIRED/u, "Il JSON inserito non è valido o non ha la struttura richiesta da questo strumento."],
  [/INVALID_(?:CSV|COLUMN|COLUMN_MAP|OUTPUT_HEADERS)|PARSE_ERROR|DUPLICATE_HEADERS|RAGGED_ROWS/u, "Controlla la struttura della tabella, le intestazioni e le colonne selezionate."],
  [/INVALID_ENCODING/u, "La codifica selezionata non è supportata. Prova UTF-8 o una delle codifiche disponibili."],
  [/REGEX_TOO_LARGE|REGEX_COMPLEXITY|INVALID_REGEX/u, "L'espressione regolare non è valida oppure è troppo complessa per essere eseguita in sicurezza."],
  [/INVALID_PDF_SIGNATURE/u, "Il file selezionato non sembra essere un PDF valido."],
  [/PDF_WEBP_UNSUPPORTED_BROWSER/u, "Questo browser non può esportare pagine PDF in WebP. Seleziona PNG o JPG: il PDF originale non è stato modificato."],
  [/MALFORMED_PDF/u, "Il PDF sembra danneggiato o usa una struttura che non può essere letta correttamente."],
  [/UNSUPPORTED_CAPABILITY|UNSUPPORTED_.*PDF|PDF.*UNSUPPORTED/u, "Questo file usa una funzione che lo strumento non supporta ancora. Il file originale non è stato modificato."],
  [/PDF.*ENCRYPT|PASSWORD/u, "Il PDF è cifrato o protetto. Questo strumento non tenta di aggirare protezioni o password."],
  [/QR_PAYLOAD_REQUIRED/u, "Inserisci il testo o l'URL da trasformare in QR."],
  [/QR_PAYLOAD_TOO_LARGE/u, "Il contenuto è troppo lungo per il QR supportato da questo strumento."],
  [/QR_(?:DECODE_FAILED|IMAGE_DECODER_UNAVAILABLE|INVALID|UNSUPPORTED)/u, "Non riesco a leggere questo QR con le capacità disponibili nel browser. Prova un'immagine più nitida o un formato diverso."],
  [/INVALID_(?:URL|URI)|URL.*INVALID/u, "Inserisci un URL valido completo di protocollo, per esempio https://esempio.it."],
  [/INVALID_INPUT/u, "Controlla i dati inseriti: uno o più campi non sono nel formato richiesto."],
  [/NOT_FOUND/u, "Questo strumento non è disponibile nella versione corrente del catalogo."],
  [/RUNTIME_ERROR/u, "L'operazione non è riuscita. I dati non sono stati modificati: controlla l'input e riprova."],
];

function looksLikeMachineError(value: string): boolean {
  return /^[A-Z][A-Z0-9_:-]*(?:\s+[A-Z0-9_:-]+)*$/u.test(value)
    || /(?:INVALID_|UNSUPPORTED_|TOO_LARGE|NOT_FOUND|RUNTIME_ERROR|MALFORMED_|_REQUIRED)/u.test(value);
}

export function friendlyToolErrorIt(value: unknown): string {
  const raw = normalizedErrorText(value);
  // Preserve the measured, actionable single-page impossibility instead of
  // hiding its exact page/byte evidence behind a generic machine-error label.
  const singlePage = /^PDF_SINGLE_PAGE_TOO_LARGE: Page ([1-9]\d*) needs ([1-9]\d*) bytes; requested ceiling ([1-9]\d*)\./u.exec(raw);
  if (singlePage !== null) {
    return `La pagina ${singlePage[1]} richiede da sola ${singlePage[2]} byte, oltre il limite di ${singlePage[3]} byte. Aumenta il limite oppure rimuovi quella pagina: nessun PDF parziale è stato generato.`;
  }
  const upper = raw.toUpperCase();
  for (const [pattern, message] of RULES) {
    if (pattern.test(upper)) return message;
  }
  if (raw !== "" && !looksLikeMachineError(raw) && /[àèéìòù]|\b(?:il|lo|la|gli|le|un|una|inserisci|controlla|scegli|operazione|file|testo)\b/iu.test(raw)) return raw;
  return "Non riesco a completare l'operazione con questi dati. Controlla i campi inseriti e riprova.";
}
