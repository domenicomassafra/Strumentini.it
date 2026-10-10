export const DEVELOPER_WEB_ENGINE_VERSION = "developer-web-v1";

export const MAX_DEVELOPER_INPUT = 1_000_000;
export const MAX_YAML_DEPTH = 32;
export const MAX_TOML_DEPTH = 16;
export const MAX_JSON_PATH_MATCHES = 1_000;

export type JsonRecord = Record<string, unknown>;

export interface DeveloperWebResult {
  readonly engineVersion?: string;
  readonly [key: string]: unknown;
}

export interface DeveloperWebErrorOptions {
  readonly cause?: unknown;
  readonly diagnostic?: DeveloperDiagnostic;
}

export interface DeveloperDiagnostic {
  readonly line?: number;
  readonly column?: number;
  readonly character?: number;
  readonly path?: string;
  readonly context?: string;
}

export interface DeveloperErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly diagnostic?: DeveloperDiagnostic;
}

const ERROR_MESSAGE_IT: Readonly<Record<string, string>> = {
  CRON_NOT_FOUND: "Non è stata trovata un'esecuzione corrispondente entro un anno di ricerca locale.",
  INPUT_TOO_LARGE: "L'ingresso supera il limite locale consentito.",
  INVALID_BASE64: "Il valore Base64 non è valido.",
  INVALID_BASE64_CHARACTER: "Il valore Base64 contiene caratteri non validi per l'alfabeto selezionato.",
  INVALID_BASE64_LENGTH: "La lunghezza Base64 non può rappresentare un payload valido.",
  INVALID_BASE64_PADDING: "Il padding Base64 non è valido o non è nella posizione canonica.",
  INVALID_CONVERSION: "La direzione di conversione non è valida.",
  INVALID_CRON: "L'espressione cron non è valida.",
  INVALID_CRON_COUNT: "Il numero di esecuzioni cron richiesto non è valido.",
  INVALID_CRON_FROM: "L'istante iniziale deve essere una data-ora ISO valida.",
  INVALID_CSS: "Il foglio CSS contiene una sintassi non valida o non rappresentabile in modo sicuro.",
  INVALID_HTML_ENTITY: "L'entità HTML non è valida o non è rappresentabile.",
  INVALID_HTML: "L'HTML contiene un errore di parsing che impedisce una minificazione sicura.",
  INVALID_HTTP_STATUS: "Il codice di stato HTTP deve essere un intero compreso tra 100 e 599.",
  INVALID_INDENT: "Il numero di spazi di rientro non è valido.",
  INVALID_INPUT: "I dati inseriti non rispettano il formato richiesto.",
  INVALID_JSON: "Il documento JSON non è valido.",
  JSON_DIFF_TOO_LARGE: "Il confronto JSON produce troppe differenze per il limite locale.",
  JSON_INFERENCE_TOO_DEEP: "L'inferenza JSON supera il limite locale di annidamento.",
  JSON_REPAIR_REFUSED: "La riparazione JSON richiederebbe una modifica ambigua e viene rifiutata.",
  INVALID_JSON_PATH: "L'espressione JSONPath non è valida o non è supportata.",
  INVALID_JWT: "Il JWT non ha una struttura valida.",
  INVALID_JWT_REFERENCE_TIME: "L'istante di riferimento del JWT deve essere una data e ora ISO valida.",
  INVALID_MIME_INPUT: "La firma esadecimale non è valida.",
  INVALID_MIME_MODE: "La modalità di ricerca MIME non è valida.",
  INVALID_MODE: "La modalità selezionata non è valida.",
  INVALID_PERCENT_ENCODING: "La codifica percentuale non rappresenta testo UTF-8 valido.",
  INVALID_REGEX: "L'espressione regolare non è valida.",
  INVALID_REGEX_FLAGS: "Le opzioni dell'espressione regolare non sono valide o sono duplicate.",
  INVALID_TIMESTAMP: "Il timestamp o la data non sono validi.",
  INVALID_TIMESTAMP_DIRECTION: "La direzione di conversione del timestamp non è valida.",
  INVALID_TIMESTAMP_UNIT: "L'unità del timestamp deve essere secondi o millisecondi.",
  INVALID_TIMEZONE: "Il fuso orario IANA selezionato non è supportato.",
  INVALID_TOML: "Il documento TOML non è valido nel sottoinsieme supportato.",
  INVALID_URL: "L'URL non è valido.",
  INVALID_URL_SET: "La parte dell'URL selezionata non è valida.",
  INVALID_UTF8_BASE64: "I byte Base64 decodificati non rappresentano testo UTF-8 valido.",
  INVALID_UUID_BYTES: "I byte UUID non sono validi.",
  INVALID_UUID_COUNT: "La quantità di UUID deve essere compresa tra 1 e 1000.",
  INVALID_UUID_VERSION: "Sono supportati soltanto UUIDv4 e UUIDv7.",
  INVALID_XML: "Il documento XML non è valido nel sottoinsieme locale supportato.",
  INVALID_SVG: "Il file SVG non è valido o supera il sottoinsieme statico ottimizzabile in sicurezza.",
  SVG_UNSAFE_CONTENT: "SVG dinamico, remoto o con elementi attivi non supportato: nessun file generato.",
  INVALID_XML_ENTITY: "Il riferimento a entità XML non è valido.",
  INVALID_YAML: "Il documento YAML non è valido nel sottoinsieme supportato.",
  JSON_PATH_TOO_DEEP: "Il percorso JSON supera il limite locale di profondità.",
  JSON_PATH_TOO_LARGE: "Il percorso JSON produce troppe corrispondenze.",
  JSON_TOO_DEEP: "L'annidamento JSON supera il limite locale di sicurezza.",
  REGEX_COMPLEXITY: "L'espressione regolare contiene una struttura rifiutata per evitare elaborazioni eccessive.",
  REGEX_TOO_LARGE: "L'espressione regolare supera il limite locale di lunghezza.",
  REGEX_TOO_MANY_MATCHES: "L'espressione regolare ha prodotto troppe corrispondenze.",
  TOML_TOO_DEEP: "L'annidamento TOML supera il limite locale di sicurezza.",
  UNKNOWN_TOOL: "Lo strumento richiesto non è riconosciuto.",
  UNSUPPORTED_HASH: "L'algoritmo hash richiesto non è supportato.",
  UNSUPPORTED_YAML: "Questa funzionalità YAML non è supportata dal parser locale.",
  YAML_TOO_DEEP: "L'annidamento YAML supera il limite locale di sicurezza.",
  XML_EXTERNAL_ENTITY_DISABLED: "DTD ed entità XML esterne sono disabilitate e non vengono risolte.",
  XML_TOO_DEEP: "L'annidamento XML supera il limite locale di sicurezza.",
  XML_TOO_LARGE: "Il documento XML supera il limite locale di nodi.",
};

export class DeveloperWebError extends Error {
  readonly code: string;
  readonly diagnostic: DeveloperDiagnostic | undefined;

  constructor(code: string, _message: string, options: DeveloperWebErrorOptions = {}) {
    const runtimeCode = code.startsWith("INVALID_") ? code : `INVALID_${code}`;
    const localizedMessage = ERROR_MESSAGE_IT[code] ?? "L'operazione non può essere completata con i dati forniti.";
    super(`${runtimeCode}: ${localizedMessage}`, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DeveloperWebError";
    this.code = code;
    this.diagnostic = options.diagnostic;
  }
}

export function invalid(code: string, message: string, diagnostic?: DeveloperDiagnostic): never {
  throw new DeveloperWebError(code, message, diagnostic === undefined ? {} : { diagnostic });
}

export function developerErrorEnvelope(error: unknown): DeveloperErrorEnvelope {
  if (error instanceof DeveloperWebError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.diagnostic === undefined ? {} : { diagnostic: error.diagnostic }),
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    message: "UNKNOWN_ERROR: L'operazione non può essere completata con i dati forniti.",
  };
}

export function assertInputSize(value: string, maximum = MAX_DEVELOPER_INPUT): void {
  if (value.length > maximum) invalid("INPUT_TOO_LARGE", `Input exceeds the ${maximum}-character local limit.`);
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid("INVALID_INPUT", "Expected an object input.");
  return value as Record<string, unknown>;
}

export function stringField(value: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string") return candidate;
  }
  invalid("INVALID_INPUT", `Expected a string field: ${keys[0] ?? "input"}.`);
}

export function optionalStringField(value: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "string") return candidate;
    invalid("INVALID_INPUT", `Expected a string field: ${key}.`);
  }
  return undefined;
}

export function optionalNumberField(value: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) continue;
    const parsed = typeof candidate === "number" ? candidate : typeof candidate === "string" && candidate.trim() !== "" ? Number(candidate) : Number.NaN;
    if (!Number.isFinite(parsed)) invalid("INVALID_INPUT", `Expected a finite number field: ${key}.`);
    return parsed;
  }
  return undefined;
}

export function booleanField(value: Record<string, unknown>, fallback: boolean, ...keys: string[]): boolean {
  for (const key of keys) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "boolean") return candidate;
    if (candidate === "true") return true;
    if (candidate === "false") return false;
    invalid("INVALID_INPUT", `Expected a boolean field: ${key}.`);
  }
  return fallback;
}

export function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operazione annullata", "AbortError");
}

export function withVersion<T extends Record<string, unknown>>(value: T): T & DeveloperWebResult {
  return { ...value, engineVersion: DEVELOPER_WEB_ENGINE_VERSION };
}
