// #556: the Worker bounds the outbound VIES call (10 s deadline, 64 KiB response
// ceiling) and reports a machine reason code. Those codes must never reach the
// reader verbatim: each one is translated into a plain Italian sentence that
// says what happened without attributing any remote validity.
const LOCAL_REASSURANCE = "Il checksum locale resta valido e non viene reinterpretato.";

const VIES_UNAVAILABLE_MESSAGES: Readonly<Record<string, string>> = {
  VIES_TIMEOUT: "VIES non ha risposto entro 10 secondi, quindi la verifica remota è stata interrotta.",
  VIES_RESPONSE_TOO_LARGE: "VIES ha inviato una risposta oltre il limite di 64 KiB e la risposta è stata scartata senza essere letta.",
  VIES_RESPONSE_UNREADABLE: "La risposta di VIES non è stata letta per intero, quindi la verifica remota non è disponibile.",
  VIES_RESPONSE_INVALID: "La risposta non è una risposta VIES ufficiale e riconoscibile, quindi nessuna validità remota viene attribuita.",
  VIES_NETWORK_UNAVAILABLE: "VIES non è raggiungibile in rete, quindi nessuna verifica remota è stata eseguita.",
};

const NO_REASON_MESSAGE = "VIES non ha fornito una risposta utilizzabile, quindi la verifica remota non è disponibile.";

/** Italian, user-facing sentence for a VIES `unavailable` reason code. */
export function viesUnavailableMessage(reason: string | undefined): string {
  const code = typeof reason === "string" ? reason.trim() : "";
  const known = code === "" ? undefined : VIES_UNAVAILABLE_MESSAGES[code];
  const explanation = known ?? (code === "" ? NO_REASON_MESSAGE : `Il servizio VIES ha segnalato un errore (codice ${code}), quindi la verifica remota non è disponibile.`);
  return `${explanation} ${LOCAL_REASSURANCE}`;
}
