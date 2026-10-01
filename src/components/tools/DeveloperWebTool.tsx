import { useMemo, useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import {
  InlineError,
  ToolGutter,
  ToolActions,
  ToolResetButton,
  ToolSurface,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";
import type { DeveloperWebToolId } from "../../engines/developer-web";
import { TOOL_COPY_IT } from "../../i18n/it/tool-copy";
import { gutterStateFor } from "./shared/ToolGutter";
import { CONTROL, it } from "./shared/controlLabels";

type FieldKind = "text" | "textarea" | "number" | "select";

interface FieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly defaultValue: string;
  readonly placeholder?: string;
  readonly rows?: number;
  readonly options?: readonly string[];
  readonly optionLabels?: Readonly<Record<string, string>>;
  readonly required?: boolean;
}

export interface DeveloperWebToolConfig {
  readonly id: DeveloperWebToolId;
  readonly title: string;
  readonly eyebrow: string;
  readonly submitLabel: string;
  readonly placeholder: string;
  readonly fields: readonly FieldDefinition[];
}

const text = (key: string, label: string, defaultValue = "", placeholder = ""): FieldDefinition => ({ key, label, kind: "text", defaultValue, placeholder, required: true });
const optionalText = (key: string, label: string, defaultValue = "", placeholder = ""): FieldDefinition => ({ key, label, kind: "text", defaultValue, placeholder, required: false });
const area = (key: string, label: string, defaultValue = "", rows = 10): FieldDefinition => ({ key, label, kind: "textarea", defaultValue, rows, required: true });
const number = (key: string, label: string, defaultValue: string): FieldDefinition => ({ key, label, kind: "number", defaultValue, required: true });
const select = (key: string, label: string, options: readonly string[], defaultValue: string): FieldDefinition => ({ key, label, kind: "select", defaultValue, options, required: true });

const DEVELOPER_WEB_CONFIGS_RAW: Readonly<Record<DeveloperWebToolId, DeveloperWebToolConfig>> = {
  "json-formatter": { id: "json-formatter", title: "JSON Formatter & Validator", eyebrow: "JSON result", submitLabel: "Format JSON", placeholder: "Enter a JSON document.", fields: [area("text", "JSON", '{"name":"Ada","items":[1,true,null]}'), select("mode", "Operation", ["format", "validate"], "format"), number("indent", "Indent spaces", "2"), select("sortKeys", "Sort object keys", ["false", "true"], "false")] },
  "yaml-formatter": { id: "yaml-formatter", title: "YAML Formatter & Validator", eyebrow: "YAML result", submitLabel: "Format YAML", placeholder: "Enter a supported YAML document.", fields: [area("text", "YAML", "name: Ada\nitems:\n  - one\n  - two\n"), number("indent", "Indent spaces", "2")] },
  "toml-formatter": { id: "toml-formatter", title: "TOML Formatter & Validator", eyebrow: "TOML result", submitLabel: "Format TOML", placeholder: "Enter a supported TOML document.", fields: [area("text", "TOML", "name = \"Ada\"\nenabled = true\n", 10)] },
  "json-yaml-converter": { id: "json-yaml-converter", title: "JSON ↔ YAML Converter", eyebrow: "Converted value", submitLabel: "Convert value", placeholder: "Enter JSON or YAML according to the selected direction.", fields: [area("text", "Source", "name: Ada\nitems:\n  - one\n  - two\n"), select("direction", "Direction", ["json-to-yaml", "yaml-to-json"], "yaml-to-json"), number("indent", "Indent spaces", "2")] },
  "url-codec": { id: "url-codec", title: "URL Encode & Decode", eyebrow: "Percent-coded value", submitLabel: "Convert value", placeholder: "Enter text to encode or decode.", fields: [area("text", "Text", "Say what‽", 3), select("mode", "Operation", ["encode", "decode"], "encode"), select("set", "URL set", ["component", "query", "path", "userinfo"], "component")] },
  "html-entity-codec": { id: "html-entity-codec", title: "HTML Entity Encode & Decode", eyebrow: "Entity value", submitLabel: "Convert entities", placeholder: "Enter text or entity references.", fields: [area("text", "Text", "<hello & goodbye>", 3), select("mode", "Operation", ["encode", "decode"], "encode"), select("numeric", "Numeric output", ["false", "true"], "false")] },
  "base64-codec": { id: "base64-codec", title: "Base64 Encode & Decode", eyebrow: "Base64 value", submitLabel: "Convert Base64", placeholder: "Enter UTF-8 text or Base64.", fields: [area("text", "Text", "Caffè ☕", 3), select("mode", "Operation", ["encode", "decode"], "encode"), select("urlSafe", "Alphabet", ["standard", "url-safe"], "standard")] },
  "jwt-inspector": { id: "jwt-inspector", title: "JWT Inspector", eyebrow: "JWT inspection", submitLabel: "Inspect JWT", placeholder: "Paste a compact JWT.", fields: [area("token", "JWT", "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ.", 4)] },
  "uuid-generator": { id: "uuid-generator", title: "UUID Generator", eyebrow: "Generated UUIDs", submitLabel: "Generate UUIDs", placeholder: "Choose a version and count.", fields: [number("count", "How many", "1"), select("version", "UUID version", ["4", "7"], "4"), select("uppercase", "Letter case", ["false", "true"], "false")] },
  "hash-generator": { id: "hash-generator", title: "Hash Generator", eyebrow: "Digest", submitLabel: "Hash text", placeholder: "Enter UTF-8 text to hash.", fields: [area("text", "Text", "abc", 4), select("algorithm", "Algorithm", ["SHA-256", "SHA-384", "SHA-512"], "SHA-256")] },
  "hmac-generator": { id: "hmac-generator", title: "HMAC Generator", eyebrow: "Authentication tag", submitLabel: "Generate HMAC", placeholder: "Enter a message and a local key.", fields: [area("message", "Message", "The quick brown fox jumps over the lazy dog", 4), text("key", "Key", "key"), select("algorithm", "Algorithm", ["SHA-256", "SHA-384", "SHA-512"], "SHA-256")] },
  "regex-tester": { id: "regex-tester", title: "Regex Tester", eyebrow: "Matches", submitLabel: "Test expression", placeholder: "Enter a regular expression and subject text.", fields: [text("pattern", "Pattern", "(\\w+)@(\\w+)"), optionalText("flags", "Flags", "g"), area("text", "Subject", "ada@example and grace@example", 5), optionalText("replacement", "Replacement", "")] },
  "cron-explainer": { id: "cron-explainer", title: "Cron Explainer", eyebrow: "Schedule explanation", submitLabel: "Explain cron", placeholder: "Enter a five-field POSIX cron expression.", fields: [text("expression", "Cron expression", "*/15 9-17 * * 1-5")] },
  "cron-next-run": { id: "cron-next-run", title: "Cron Next-Run Calculator", eyebrow: "Upcoming UTC runs", submitLabel: "Calculate next runs", placeholder: "Enter a cron expression and an optional ISO start time.", fields: [text("expression", "Cron expression", "*/15 * * * *"), optionalText("from", "From (UTC ISO)", "2026-01-01T00:00:00.000Z"), number("count", "How many runs", "5")] },
  "unix-timestamp": { id: "unix-timestamp", title: "Unix Timestamp Converter", eyebrow: "UTC date-time", submitLabel: "Convert timestamp", placeholder: "Enter a Unix timestamp or an ISO date.", fields: [text("value", "Timestamp or date", "0"), select("unit", "Unit", ["seconds", "milliseconds"], "seconds"), select("direction", "Direction", ["to-date", "to-timestamp"], "to-date")] },
  "http-status-reference": { id: "http-status-reference", title: "HTTP Status Reference", eyebrow: "Status meaning", submitLabel: "Look up status", placeholder: "Enter an HTTP status code.", fields: [number("status", "HTTP status", "404")] },
  "mime-type-lookup": { id: "mime-type-lookup", title: "MIME Type Lookup", eyebrow: "Media type evidence", submitLabel: "Look up type", placeholder: "Enter an extension, filename, or signature hex.", fields: [text("lookup", "Extension or filename", "png"), select("mode", "Lookup mode", ["extension", "signature"], "extension"), optionalText("bytes", "Signature hex (optional)", "")] },
  "user-agent-parser": { id: "user-agent-parser", title: "User-Agent Parser", eyebrow: "Descriptive hints", submitLabel: "Parse user-agent", placeholder: "Paste a user-agent string.", fields: [area("userAgent", "User-agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", 5)] },
  "query-string-editor": { id: "query-string-editor", title: "Query-String Editor", eyebrow: "Edited query", submitLabel: "Edit query", placeholder: "Enter a query string or full URL.", fields: [area("query", "Query or URL", "a=1&a=2&blank=&space=hello+world", 3), optionalText("baseUrl", "Base URL (optional)", ""), optionalText("setKey", "Set key (optional)", ""), optionalText("setValue", "Set value (optional)", ""), optionalText("removeKey", "Remove key (optional)", ""), select("sort", "Sort pairs", ["false", "true"], "false")] },
  "json-path-playground": { id: "json-path-playground", title: "JSON Path Playground", eyebrow: "Path matches", submitLabel: "Query JSON", placeholder: "Enter JSON and a bounded JSONPath expression.", fields: [area("json", "JSON", '{"users":[{"name":"Ada"},{"name":"Grace"}]}', 8), text("path", "JSONPath", "$.users[*].name")] },
};

const FIELD_LABEL_IT: Readonly<Record<string, string>> = {
  text: "Testo",
  mode: "Operazione",
  indent: "Spazi di rientro",
  sortKeys: "Ordina le chiavi",
  direction: "Direzione",
  set: "Parte dell'URL",
  numeric: "Usa entità numeriche",
  urlSafe: "Alfabeto",
  token: "JWT",
  count: "Quantità",
  version: "Versione UUID",
  uppercase: "Usa lettere maiuscole",
  algorithm: "Algoritmo",
  message: "Messaggio",
  key: "Chiave",
  pattern: "Espressione",
  flags: "Opzioni",
  replacement: "Sostituzione",
  expression: "Espressione cron",
  from: "Da (ISO UTC)",
  value: "Valore",
  unit: "Unità",
  status: "Stato HTTP",
  lookup: "Estensione o nome file",
  bytes: "Firma esadecimale",
  userAgent: "User-Agent",
  query: "Parametri o URL",
  baseUrl: "URL di base (facoltativo)",
  setKey: "Chiave da impostare (facoltativa)",
  setValue: "Valore da impostare (facoltativo)",
  removeKey: "Chiave da rimuovere (facoltativa)",
  sort: "Ordina le coppie",
  json: "JSON",
  path: "JSONPath",
};

const OPTION_LABEL_IT: Readonly<Record<string, string>> = {
  format: "Formatta",
  validate: "Valida",
  "json-to-yaml": "Da JSON a YAML",
  "yaml-to-json": "Da YAML a JSON",
  encode: "Codifica",
  decode: "Decodifica",
  component: "Componente",
  query: "Parametri",
  path: "Percorso",
  userinfo: "Credenziali utente",
  false: "No",
  true: "Sì",
  standard: "Standard",
  "url-safe": "Sicuro per URL",
  seconds: "Secondi",
  milliseconds: "Millisecondi",
  "to-date": "Da timestamp a data",
  "to-timestamp": "Da data a timestamp",
  extension: "Estensione",
  signature: "Firma",
};

const DEVELOPER_ACTION_IT: Readonly<Record<DeveloperWebToolId, readonly [eyebrow: string, submit: string]>> = {
  "json-formatter": ["Risultato JSON", "Formatta JSON"],
  "yaml-formatter": ["Risultato YAML", "Formatta YAML"],
  "toml-formatter": ["Risultato TOML", "Formatta TOML"],
  "json-yaml-converter": ["Valore convertito", "Converti"],
  "url-codec": ["Valore codificato", "Converti"],
  "html-entity-codec": ["Valore delle entità", "Converti entità"],
  "base64-codec": ["Valore Base64", "Converti Base64"],
  "jwt-inspector": ["Analisi JWT", "Analizza JWT"],
  "uuid-generator": ["UUID generati", "Genera UUID"],
  "hash-generator": ["Hash", "Calcola hash"],
  "hmac-generator": ["Tag di autenticazione", "Genera HMAC"],
  "regex-tester": ["Corrispondenze", "Prova espressione"],
  "cron-explainer": ["Spiegazione pianificazione", "Spiega cron"],
  "cron-next-run": ["Prossime esecuzioni UTC", "Calcola esecuzioni"],
  "unix-timestamp": ["Data e ora UTC", "Converti timestamp"],
  "http-status-reference": ["Significato dello stato", "Cerca stato"],
  "mime-type-lookup": ["Indicazioni sul tipo MIME", "Cerca tipo"],
  "user-agent-parser": ["Indicazioni descrittive", "Analizza User-Agent"],
  "query-string-editor": ["Parametri modificati", "Modifica parametri"],
  "json-path-playground": ["Corrispondenze del percorso", "Interroga JSON"],
};

function localizeDeveloperConfig(config: DeveloperWebToolConfig): DeveloperWebToolConfig {
  const [eyebrow, submitLabel] = DEVELOPER_ACTION_IT[config.id];
  return {
    ...config,
    title: TOOL_COPY_IT[config.id]?.name ?? config.id,
    eyebrow,
    submitLabel,
    placeholder: "Inserisci i valori richiesti.",
    fields: config.fields.map((field) => ({
      ...field,
      label: FIELD_LABEL_IT[field.key] ?? field.label,
      ...(field.placeholder === undefined ? {} : { placeholder: "Inserisci un valore." }),
      ...(field.options === undefined
        ? {}
        : { optionLabels: Object.fromEntries(field.options.map((option) => [option, OPTION_LABEL_IT[option] ?? option])) }),
    })),
  };
}

export const DEVELOPER_WEB_CONFIGS: Readonly<Record<DeveloperWebToolId, DeveloperWebToolConfig>> =
  Object.fromEntries(
    Object.entries(DEVELOPER_WEB_CONFIGS_RAW).map(([id, config]) => [id, localizeDeveloperConfig(config)]),
  ) as Record<DeveloperWebToolId, DeveloperWebToolConfig>;

function initialValues(config: DeveloperWebToolConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.defaultValue]));
}

const RESULT_KEY_IT: Readonly<Record<string, string>> = {
  valid: "valido",
  mode: "modalità",
  set: "insieme",
  value: "valore",
  output: "risultato",
  formatted: "formattato",
  warning: "avviso",
  warnings: "avvisi",
  error: "errore",
  code: "codice",
  byteLength: "byte",
  bytes: "valori_byte",
  roundTrip: "conversione_reversibile",
  algorithm: "algoritmo",
  digestHex: "hash_esadecimale",
  digestBase64: "hash_base64",
  version: "versione",
  count: "quantità",
  uuids: "uuid",
  randomness: "origine_casualità",
  pattern: "espressione",
  flags: "opzioni",
  matches: "corrispondenze",
  matchCount: "numero_corrispondenze",
  replaced: "testo_sostituito",
  global: "globale",
  unicode: "unicode",
  direction: "direzione",
  duplicateKeys: "chiavi_duplicate",
  engineVersion: "versione_motore",
  status: "stato",
  category: "categoria",
  meaning: "significato",
  extension: "estensione",
  extensions: "estensioni",
  mime: "tipo_mime",
  evidence: "evidenza",
  confidence: "affidabilità",
  source: "fonte",
  browser: "browser",
  os: "sistema_operativo",
  device: "dispositivo",
  removed: "rimossi",
  pairCount: "numero_coppie",
  date: "data",
  timestamp: "timestamp",
  numeric: "valore_numerico",
  unit: "unità",
  expression: "espressione",
  from: "da",
  runs: "esecuzioni",
  timezone: "fuso_orario",
  schedule: "pianificazione",
  minute: "minuto",
  hour: "ora",
  dayOfMonth: "giorno_del_mese",
  month: "mese",
  dayOfWeek: "giorno_della_settimana",
  command: "comando",
};

const RESULT_VALUE_IT: Readonly<Record<string, string>> = {
  encode: "codifica",
  decode: "decodifica",
  format: "formattazione",
  validate: "validazione",
  cryptographic: "crittografica",
  "explicit-test-input": "ingresso di prova esplicito",
  "signature-hint": "indizio dalla firma",
  "to-date": "da timestamp a data",
  "to-timestamp": "da data a timestamp",
  seconds: "secondi",
  milliseconds: "millisecondi",
};

const RAW_RESULT_KEYS = new Set(["value", "header", "payload", "document"]);

function localizeResult(value: unknown, raw = false): unknown {
  if (raw || value === null || typeof value !== "object") {
    return typeof value === "string" ? (RESULT_VALUE_IT[value] ?? value) : value;
  }
  if (Array.isArray(value)) return value.map((item) => localizeResult(item));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    RESULT_KEY_IT[key] ?? key,
    localizeResult(item, RAW_RESULT_KEYS.has(key)),
  ]));
}

function resultText(value: unknown): string {
  try {
    return JSON.stringify(localizeResult(value), null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function errorText(message: string): string {
  const known: Readonly<Record<string, string>> = {
    INVALID_JSON: "Il documento JSON non è valido secondo la grammatica RFC 8259.",
    INVALID_JSON_PATH: "L'espressione JSONPath non rientra nel sottoinsieme supportato.",
    INVALID_CRON: "L'espressione cron non è una pianificazione POSIX valida a cinque campi.",
    INVALID_BASE64: "Il valore Base64 non è valido. Rimuovi gli spazi superflui o correggi il riempimento.",
    INVALID_YAML: "Il documento YAML non rientra nel sottoinsieme sicuro supportato.",
    UNSUPPORTED_YAML: "Questa funzionalità YAML non viene eseguita dal formattatore locale.",
    INVALID_TOML: "Il documento TOML non rientra nel sottoinsieme sicuro supportato.",
    INVALID_JWT: "Il JWT deve essere composto da tre parti compatte con intestazione e contenuto JSON.",
    INVALID_PERCENT_ENCODING: "I byte codificati percentualmente non rappresentano testo UTF-8 valido.",
    INVALID_UTF8_BASE64: "I byte Base64 decodificati non rappresentano testo UTF-8 valido.",
    INVALID_MODE: "La modalità selezionata non è valida.",
    INVALID_INPUT: "Controlla i valori inseriti.",
    INVALID_UUID_COUNT: "La quantità di UUID deve essere un intero compreso tra 1 e 1000.",
    INVALID_UUID_VERSION: "Sono supportati UUIDv4 e UUIDv7.",
    INVALID_REGEX: "L'espressione regolare non è valida.",
    INVALID_REGEX_FLAGS: "Le opzioni dell'espressione regolare non sono valide o sono duplicate.",
    REGEX_TOO_LARGE: "L'espressione regolare supera il limite locale consentito.",
    REGEX_COMPLEXITY: "L'espressione contiene quantificatori annidati non limitati e viene rifiutata per sicurezza.",
    REGEX_TOO_MANY_MATCHES: "L'espressione regolare ha prodotto troppe corrispondenze.",
  };
  const code = message.split(":", 1)[0] ?? message;
  return known[code] ?? `Errore dello strumento (${code}). Controlla i valori inseriti.`;
}

export interface DeveloperWebToolProps {
  readonly config: DeveloperWebToolConfig;
}

export function DeveloperWebTool({ config }: DeveloperWebToolProps) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config));
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(config.id, values, {}, signal),
    { formatError: (result) => errorText(result.message) },
  );
  const fieldIds = useMemo(() => Object.fromEntries(config.fields.map((field) => [field.key, `${config.id}-${field.key}`])), [config]);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setValues(initialValues(config));
    operation.reset();
  }

  const gutterState = gutterStateFor(operation.status);

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label={config.eyebrow}
          state={gutterState}
          placeholder={operation.isRunning ? it(CONTROL.gutterRunning) : it(CONTROL.gutterIdle)}
          busy={operation.isRunning}
        >
          {operation.result !== null && (
            <pre class="developer-result-json" aria-label={`${config.title} — risultato`}>
              {resultText(operation.result)}
            </pre>
          )}
        </ToolGutter>
      }
    >
      <form onSubmit={submit} aria-label={config.title} noValidate aria-busy={operation.isRunning ? "true" : undefined}>
        <div class="field-grid">
          {config.fields.map((field) => {
            const id = fieldIds[field.key];
            const value = values[field.key] ?? "";
            return (
              <label class="field" for={id} key={field.key}>
                <span>{field.label}</span>
                {field.kind === "textarea" && <textarea id={id} rows={field.rows ?? 8} value={value} placeholder={field.placeholder} onInput={(event) => update(field.key, event.currentTarget.value)} required={field.required} />}
                {field.kind === "text" && <input id={id} type="text" value={value} placeholder={field.placeholder} onInput={(event) => update(field.key, event.currentTarget.value)} required={field.required} />}
                {field.kind === "number" && <input id={id} type="number" value={value} onInput={(event) => update(field.key, event.currentTarget.value)} required={field.required} />}
                {field.kind === "select" && <select id={id} value={value} onChange={(event) => update(field.key, event.currentTarget.value)} required={field.required}>{field.options?.map((option) => <option value={option} key={option}>{field.optionLabels?.[option] ?? option}</option>)}</select>}
              </label>
            );
          })}
        </div>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
    </ToolSurface>
  );
}
