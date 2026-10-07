import {
  type DeveloperWebResult,
  assertInputSize,
  booleanField,
  invalid,
  optionalStringField,
  stringField,
} from "./types";

const HTTP_STATUSES: Readonly<Record<number, { reason: string; description: string }>> = {
  100: { reason: "Continua", description: "Le intestazioni della richiesta sono state ricevute." },
  101: { reason: "Cambio protocollo", description: "Il server sta cambiando protocollo." },
  200: { reason: "OK", description: "La richiesta è stata completata con successo." },
  201: { reason: "Creato", description: "La richiesta ha creato una risorsa." },
  202: { reason: "Accettato", description: "La richiesta è stata accettata per l'elaborazione." },
  204: { reason: "Nessun contenuto", description: "La risposta non contiene intenzionalmente un corpo." },
  206: { reason: "Contenuto parziale", description: "La risposta contiene l'intervallo richiesto." },
  301: { reason: "Spostato definitivamente", description: "La risorsa ha un nuovo URL permanente." },
  302: { reason: "Trovato", description: "La risorsa si trova temporaneamente a un altro URL." },
  304: { reason: "Non modificato", description: "La rappresentazione nella cache è ancora valida." },
  307: { reason: "Reindirizzamento temporaneo", description: "La richiesta deve essere ripetuta su un altro URL." },
  308: { reason: "Reindirizzamento permanente", description: "La richiesta deve essere ripetuta definitivamente su un altro URL." },
  400: { reason: "Richiesta non valida", description: "Il server non può elaborare la richiesta così come è stata inviata." },
  401: { reason: "Autenticazione richiesta", description: "Per questa risorsa è richiesta l'autenticazione." },
  403: { reason: "Accesso vietato", description: "Il server ha compreso la richiesta ma la rifiuta." },
  404: { reason: "Non trovato", description: "Il server non ha trovato una risorsa corrispondente." },
  405: { reason: "Metodo non consentito", description: "Il metodo della richiesta non è supportato per questa risorsa." },
  408: { reason: "Tempo di richiesta scaduto", description: "Il server ha superato il tempo di attesa della richiesta." },
  409: { reason: "Conflitto", description: "La richiesta è in conflitto con lo stato attuale della risorsa." },
  410: { reason: "Non più disponibile", description: "La risorsa non è più disponibile." },
  413: { reason: "Contenuto troppo grande", description: "Il contenuto della richiesta è troppo grande." },
  415: { reason: "Tipo multimediale non supportato", description: "Il formato del contenuto della richiesta non è supportato." },
  422: { reason: "Contenuto non elaborabile", description: "Il server non può elaborare la semantica della richiesta." },
  429: { reason: "Troppe richieste", description: "Il client ha inviato troppe richieste." },
  500: { reason: "Errore interno del server", description: "Il server ha incontrato una condizione imprevista." },
  501: { reason: "Non implementato", description: "Il server non supporta la funzionalità richiesta." },
  502: { reason: "Gateway non valido", description: "Un server a monte ha restituito una risposta non valida." },
  503: { reason: "Servizio non disponibile", description: "Il servizio è temporaneamente non disponibile." },
  504: { reason: "Tempo del gateway scaduto", description: "Un server a monte non ha risposto in tempo." },
};

function statusClass(status: number): string {
  if (status >= 100 && status < 200) return "informational";
  if (status >= 200 && status < 300) return "successful";
  if (status >= 300 && status < 400) return "redirection";
  if (status >= 400 && status < 500) return "client-error";
  if (status >= 500 && status < 600) return "server-error";
  return "unknown";
}

export function httpStatusOperation(input: unknown): DeveloperWebResult {
  const value = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isInteger(value) || value < 100 || value > 599) invalid("INVALID_HTTP_STATUS", "HTTP status must be an integer from 100 through 599.");
  const entry = HTTP_STATUSES[value];
  return {
    valid: true,
    status: value,
    class: statusClass(value),
    reason: entry?.reason ?? "Stato non registrato o poco comune",
    description: entry?.description ?? "Il codice rientra nell'intervallo HTTP valido ma non è presente nel riferimento locale.",
    reasonPhraseIsDisplayHint: true,
    source: "Semantica degli stati da RFC 9110; la frase è un'indicazione locale per la visualizzazione.",
  } as DeveloperWebResult;
}

const MIME_BY_EXTENSION: Readonly<Record<string, { mime: string; extensions: string[] }>> = {
  ".css": { mime: "text/css", extensions: [".css"] },
  ".csv": { mime: "text/csv", extensions: [".csv"] },
  ".gif": { mime: "image/gif", extensions: [".gif"] },
  ".gz": { mime: "application/gzip", extensions: [".gz"] },
  ".htm": { mime: "text/html", extensions: [".htm", ".html"] },
  ".html": { mime: "text/html", extensions: [".htm", ".html"] },
  ".ico": { mime: "image/x-icon", extensions: [".ico"] },
  ".jpeg": { mime: "image/jpeg", extensions: [".jpeg", ".jpg"] },
  ".jpg": { mime: "image/jpeg", extensions: [".jpeg", ".jpg"] },
  ".js": { mime: "text/javascript", extensions: [".js", ".mjs"] },
  ".json": { mime: "application/json", extensions: [".json"] },
  ".mjs": { mime: "text/javascript", extensions: [".js", ".mjs"] },
  ".pdf": { mime: "application/pdf", extensions: [".pdf"] },
  ".png": { mime: "image/png", extensions: [".png"] },
  ".svg": { mime: "image/svg+xml", extensions: [".svg"] },
  ".txt": { mime: "text/plain", extensions: [".txt"] },
  ".webp": { mime: "image/webp", extensions: [".webp"] },
  ".xml": { mime: "application/xml", extensions: [".xml"] },
  ".yaml": { mime: "application/yaml", extensions: [".yaml", ".yml"] },
  ".yml": { mime: "application/yaml", extensions: [".yaml", ".yml"] },
  ".zip": { mime: "application/zip", extensions: [".zip"] },
};

function parseHexBytes(value: string): Uint8Array {
  const normalized = value.replace(/0x/giu, "").replace(/[\s:_-]/gu, "");
  if (normalized.length === 0 || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/iu.test(normalized)) invalid("INVALID_MIME_INPUT", "Hex input must contain an even number of hexadecimal characters.");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function ascii(bytes: Uint8Array, offset: number, expected: string): boolean {
  return offset + expected.length <= bytes.length && [...expected].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function inspectMimeSignature(bytes: Uint8Array): { mime: string; evidence: string; confidence: "signature-hint" } | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return { mime: "image/png", evidence: "Firma PNG", confidence: "signature-hint" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", evidence: "Prefisso SOI JPEG", confidence: "signature-hint" };
  if (bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return { mime: "image/webp", evidence: "Firma RIFF/WEBP", confidence: "signature-hint" };
  if (bytes.length >= 5 && ascii(bytes, 0, "%PDF-")) return { mime: "application/pdf", evidence: "Intestazione PDF", confidence: "signature-hint" };
  if (bytes.length >= 6 && ascii(bytes, 0, "GIF87a")) return { mime: "image/gif", evidence: "Firma GIF87a", confidence: "signature-hint" };
  if (bytes.length >= 6 && ascii(bytes, 0, "GIF89a")) return { mime: "image/gif", evidence: "Firma GIF89a", confidence: "signature-hint" };
  if (bytes.length >= 4 && [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]].some((signature) => signature.every((value, index) => bytes[index] === value))) return { mime: "application/zip", evidence: "Firma ZIP", confidence: "signature-hint" };
  return null;
}

export function mimeTypeOperation(lookup: string, mode: string, byteInput?: string): DeveloperWebResult {
  if (mode !== "extension" && mode !== "signature") invalid("INVALID_MIME_MODE", "MIME lookup mode must be extension or signature.");
  const hasByteInput = byteInput !== undefined && byteInput.trim() !== "";
  if (mode === "signature" || hasByteInput) {
    const bytes = parseHexBytes(byteInput ?? lookup);
    const signature = inspectMimeSignature(bytes);
    if (signature === null) return { valid: false, mime: null, evidence: "Nessuna firma supportata corrisponde", warning: "Una firma sconosciuta non dimostra che un file sia sicuro o pericoloso." } as DeveloperWebResult;
    return { valid: true, ...signature, byteLength: bytes.length, warning: "I byte iniziali sono un indizio, non una validazione completa del contenuto." } as DeveloperWebResult;
  }
  const normalized = lookup.trim().toLowerCase();
  const extension = normalized.startsWith(".") ? normalized : `.${normalized.replace(/^.*\./u, "")}`;
  const entry = MIME_BY_EXTENSION[extension];
  if (entry === undefined) return { valid: false, mime: null, extension, warning: "L'estensione non è presente nel riferimento locale ispirato al registro IANA." } as DeveloperWebResult;
  return { valid: true, extension, mime: entry.mime, extensions: entry.extensions, source: "Riferimento dei tipi multimediali IANA; l'estensione è un'etichetta, non una verifica di sicurezza." } as DeveloperWebResult;
}

export interface UserAgentInfo {
  readonly raw: string;
  readonly browser: string;
  readonly version: string | null;
  readonly os: string;
  readonly device: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  readonly engine: string | null;
  readonly mobile: boolean;
  readonly bot: boolean;
  readonly warnings: string[];
}

export function parseUserAgent(raw: string): UserAgentInfo {
  assertInputSize(raw, 100_000);
  const bot = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|curl|wget|headlesschrome/iu.test(raw);
  const mobile = /Mobile|Android|iPhone|iPod|Windows Phone/iu.test(raw);
  const tablet = /iPad|Tablet|PlayBook|Silk/iu.test(raw) || (/Android/iu.test(raw) && !/Mobile/iu.test(raw));
  let browser = "Sconosciuto";
  let version: string | null = null;
  const browserPatterns: Array<[string, RegExp]> = [
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/iu],
    ["Opera", /(?:OPR|Opera)\/([\d.]+)/iu],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/iu],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/iu],
    ["Safari", /Version\/([\d.]+).*Safari/iu],
    ["Internet Explorer", /(?:MSIE\s|rv:)([\d.]+)/iu],
  ];
  for (const [name, pattern] of browserPatterns) {
    const match = pattern.exec(raw);
    if (match !== null) {
      browser = name;
      version = match[1] ?? null;
      break;
    }
  }
  let os = "Sconosciuto";
  if (/Windows NT/iu.test(raw)) os = "Windows";
  else if (/iPhone|iPod|iPad/iu.test(raw)) os = "iOS";
  else if (/Android/iu.test(raw)) os = "Android";
  else if (/Mac OS X|Macintosh/iu.test(raw)) os = "macOS";
  else if (/CrOS/iu.test(raw)) os = "ChromeOS";
  else if (/Linux/iu.test(raw)) os = "Linux";
  const engine = /Gecko\//iu.test(raw) && !/like Gecko/iu.test(raw) ? "Gecko" : /WebKit\//iu.test(raw) ? "WebKit" : /Trident\//iu.test(raw) ? "Trident" : null;
  const device = bot ? "bot" : tablet ? "tablet" : mobile ? "mobile" : /Windows|Macintosh|X11|Linux/iu.test(raw) ? "desktop" : "unknown";
  return {
    raw,
    browser,
    version,
    os,
    device,
    engine,
    mobile,
    bot,
    warnings: ["L'analisi dello User-Agent è soltanto descrittiva; le capacità vanno determinate verificando direttamente le funzionalità disponibili."],
  };
}

export function userAgentOperation(raw: string): DeveloperWebResult {
  return { valid: true, ...parseUserAgent(raw) } as DeveloperWebResult;
}

export function queryStringOperation(input: Record<string, unknown>): DeveloperWebResult {
  const query = stringField(input, "query", "url", "input", "text");
  const baseUrl = optionalStringField(input, "baseUrl", "url");
  const setKey = optionalStringField(input, "setKey", "key");
  const setValue = optionalStringField(input, "setValue", "value");
  const removeKeys = input.removeKeys ?? input.removeKey;
  const sort = booleanField(input, false, "sort");
  assertInputSize(query);
  let parsedBase: URL | undefined;
  if (baseUrl !== undefined && baseUrl !== "") {
    try {
      parsedBase = new URL(baseUrl);
    } catch {
      invalid("INVALID_URL", "Base URL must be an absolute URL.");
    }
  }
  const queryStart = query.indexOf("?");
  let rawQuery: string;
  if (queryStart >= 0 && /^[a-z][a-z\d+.-]*:\/\//iu.test(query)) {
    try {
      parsedBase = new URL(query);
    } catch {
      invalid("INVALID_URL", "The full URL must be absolute and valid.");
    }
    rawQuery = parsedBase.search.slice(1);
  } else {
    rawQuery = queryStart >= 0 ? query.slice(queryStart + 1).split("#", 1)[0] ?? "" : query.split("#", 1)[0] ?? "";
  }
  const params = new URLSearchParams(rawQuery);
  const removed: string[] = [];
  if (typeof removeKeys === "string" && removeKeys.trim() !== "") removed.push(removeKeys);
  if (Array.isArray(removeKeys)) for (const key of removeKeys) if (typeof key === "string") removed.push(key);
  for (const key of removed) {
    for (const existing of [...params.keys()]) if (existing === key) params.delete(existing);
  }
  if (setKey !== undefined && setKey !== "") params.set(setKey, setValue ?? "");
  if (sort) params.sort();
  const pairs = Array.from(params.entries()).map(([key, value]) => ({ key, value }));
  const serialized = params.toString();
  const finalQuery = serialized === "" ? "" : `?${serialized}`;
  if (parsedBase !== undefined) parsedBase.search = serialized;
  return {
    valid: true,
    input: query,
    query: serialized,
    pairs,
    pairCount: pairs.length,
    removed,
    url: parsedBase?.href,
    finalQuery,
    warnings: [],
  } as DeveloperWebResult;
}

function parseTimestampInput(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (Number.isFinite(numeric)) return numeric;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  invalid("INVALID_TIMESTAMP", "Timestamp must be a finite number or a parseable date string.");
}

export function unixTimestampOperation(value: unknown, unit: string, direction: string): DeveloperWebResult {
  if (unit !== "seconds" && unit !== "milliseconds") invalid("INVALID_TIMESTAMP_UNIT", "Unix timestamp unit must be seconds or milliseconds.");
  if (direction !== "to-date" && direction !== "to-timestamp" && direction !== "from-date") invalid("INVALID_TIMESTAMP_DIRECTION", "Timestamp direction must be to-date or to-timestamp.");
  if (direction === "to-timestamp" || direction === "from-date") {
    const milliseconds = parseTimestampInput(value);
    const divisor = unit === "milliseconds" ? 1 : 1000;
    const timestamp = milliseconds / divisor;
    if (!Number.isFinite(timestamp)) invalid("INVALID_TIMESTAMP", "The date is outside the supported range.");
    return { valid: true, direction, unit, timestamp, date: new Date(milliseconds).toISOString(), numeric: timestamp } as DeveloperWebResult;
  }
  const numeric = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric)) invalid("INVALID_TIMESTAMP", "Unix timestamp must be finite.");
  const milliseconds = unit === "milliseconds" ? numeric : numeric * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) invalid("INVALID_TIMESTAMP", "Unix timestamp is outside the supported date range.");
  return { valid: true, direction: "to-date", unit, timestamp: numeric, date: date.toISOString(), numeric: date.getTime() } as DeveloperWebResult;
}

interface CronField {
  readonly values: number[];
  readonly restricted: boolean;
}

interface CronSchedule {
  readonly minute: CronField;
  readonly hour: CronField;
  readonly dayOfMonth: CronField;
  readonly month: CronField;
  readonly dayOfWeek: CronField;
  readonly command: string;
  readonly expression: string;
}

const MONTH_NAMES: Readonly<Record<string, number>> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DAY_NAMES: Readonly<Record<string, number>> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function cronValue(token: string, minimum: number, maximum: number, names: Readonly<Record<string, number>> = {}): number {
  const normalized = token.toLowerCase();
  if (names[normalized] !== undefined) return names[normalized]!;
  if (!/^[0-9]+$/u.test(normalized)) invalid("INVALID_CRON", `Invalid cron value: ${token}.`);
  const value = Number(normalized);
  if (!Number.isInteger(value) || value < minimum || value > maximum) invalid("INVALID_CRON", `Cron value is outside ${minimum}-${maximum}: ${token}.`);
  return value;
}

function parseCronField(raw: string, minimum: number, maximum: number, names: Readonly<Record<string, number>> = {}): CronField {
  if (raw === "") invalid("INVALID_CRON", "Cron fields cannot be empty.");
  if (raw === "*") return { values: Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index), restricted: false };
  const values = new Set<number>();
  for (const part of raw.split(",")) {
    const [rangePart, stepPart, ...extra] = part.split("/");
    if (extra.length > 0 || rangePart === undefined || rangePart === "") invalid("INVALID_CRON", `Invalid cron field: ${raw}.`);
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isSafeInteger(step) || step < 1) invalid("INVALID_CRON", `Invalid cron step: ${stepPart}.`);
    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = minimum;
      end = maximum;
    } else if (rangePart.includes("-")) {
      const [left, right, ...rangeExtra] = rangePart.split("-");
      if (rangeExtra.length > 0 || left === undefined || right === undefined) invalid("INVALID_CRON", `Invalid cron range: ${rangePart}.`);
      start = cronValue(left, minimum, maximum, names);
      end = cronValue(right, minimum, maximum, names);
      if (start > end) invalid("INVALID_CRON", `Cron range is reversed: ${rangePart}.`);
    } else {
      start = cronValue(rangePart, minimum, maximum, names);
      end = stepPart === undefined ? start : maximum;
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return { values: [...values].sort((left, right) => left - right), restricted: true };
}

function parseCronExpression(input: string): CronSchedule {
  assertInputSize(input, 100_000);
  const normalized = input.trim().replace(/\r\n?/gu, "\n");
  if (normalized === "") invalid("INVALID_CRON", "Cron expression cannot be empty.");
  const special: Readonly<Record<string, string>> = { "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *" };
  const firstLine = normalized.split("\n").find((line) => line.trim() !== "" && !line.trimStart().startsWith("#")) ?? "";
  const expression = special[firstLine.trim().toLowerCase()] ?? firstLine.trim();
  const parts = expression.split(/\s+/u);
  if (parts.length < 5) invalid("INVALID_CRON", "A cron expression needs five schedule fields.");
  const minute = parseCronField(parts[0]!, 0, 59);
  const hour = parseCronField(parts[1]!, 0, 23);
  const dayOfMonth = parseCronField(parts[2]!, 1, 31);
  const month = parseCronField(parts[3]!, 1, 12, MONTH_NAMES);
  const dayOfWeekRaw = parts[4]!;
  const dayOfWeek = parseCronField(dayOfWeekRaw, 0, 7, DAY_NAMES);
  const normalizedDow = new Set(dayOfWeek.values.map((value) => value === 7 ? 0 : value));
  return { minute, hour, dayOfMonth, month, dayOfWeek: { values: [...normalizedDow].sort((left, right) => left - right), restricted: dayOfWeek.restricted }, command: parts.slice(5).join(" "), expression };
}

function cronFieldText(field: CronField): string {
  return field.restricted ? field.values.join(",") : "*";
}

export function explainCronOperation(input: string): DeveloperWebResult {
  const schedule = parseCronExpression(input);
  return {
    valid: true,
    expression: schedule.expression,
    command: schedule.command,
    fields: {
      minute: { values: schedule.minute.values, expression: cronFieldText(schedule.minute), meaning: "Minuto dell'ora (0-59)." },
      hour: { values: schedule.hour.values, expression: cronFieldText(schedule.hour), meaning: "Ora del giorno (0-23)." },
      dayOfMonth: { values: schedule.dayOfMonth.values, expression: cronFieldText(schedule.dayOfMonth), meaning: "Giorno del mese (1-31)." },
      month: { values: schedule.month.values, expression: cronFieldText(schedule.month), meaning: "Mese dell'anno (1-12)." },
      dayOfWeek: { values: schedule.dayOfWeek.values, expression: cronFieldText(schedule.dayOfWeek), meaning: "Giorno della settimana (0 o 7 domenica, 0-6)." },
    },
    semantics: "Sintassi POSIX a cinque campi; quando entrambi i campi del giorno sono limitati, basta che ne corrisponda uno.",
    warnings: ["La spiegazione riguarda soltanto l'espressione: non ispeziona il fuso orario del sistema né l'implementazione del pianificatore."],
  } as DeveloperWebResult;
}

function matchesCron(schedule: CronSchedule, date: Date): boolean {
  if (!schedule.minute.values.includes(date.getUTCMinutes())) return false;
  if (!schedule.hour.values.includes(date.getUTCHours())) return false;
  if (!schedule.month.values.includes(date.getUTCMonth() + 1)) return false;
  const domMatch = schedule.dayOfMonth.values.includes(date.getUTCDate());
  const dowMatch = schedule.dayOfWeek.values.includes(date.getUTCDay());
  if (schedule.dayOfMonth.restricted && schedule.dayOfWeek.restricted) return domMatch || dowMatch;
  if (schedule.dayOfMonth.restricted) return domMatch;
  if (schedule.dayOfWeek.restricted) return dowMatch;
  return true;
}

interface CronWallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly dayOfWeek: number;
}

function cronTimeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    invalid("INVALID_TIMEZONE", "The selected IANA timezone is not supported by this browser.");
  }
}

function wallClock(formatter: Intl.DateTimeFormat, date: Date): CronWallClock {
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function matchesCronWallClock(schedule: CronSchedule, value: CronWallClock): boolean {
  if (!schedule.minute.values.includes(value.minute)) return false;
  if (!schedule.hour.values.includes(value.hour)) return false;
  if (!schedule.month.values.includes(value.month)) return false;
  const domMatch = schedule.dayOfMonth.values.includes(value.day);
  const dowMatch = schedule.dayOfWeek.values.includes(value.dayOfWeek);
  if (schedule.dayOfMonth.restricted && schedule.dayOfWeek.restricted) return domMatch || dowMatch;
  if (schedule.dayOfMonth.restricted) return domMatch;
  if (schedule.dayOfWeek.restricted) return dowMatch;
  return true;
}

function wallClockIso(value: CronWallClock): string {
  const two = (part: number) => part.toString().padStart(2, "0");
  return `${value.year.toString().padStart(4, "0")}-${two(value.month)}-${two(value.day)}T${two(value.hour)}:${two(value.minute)}`;
}

export function nextCronRuns(input: string, from: string, count: number): string[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) invalid("INVALID_CRON_COUNT", "Next-run count must be an integer from 1 through 20.");
  const schedule = parseCronExpression(input);
  const startMilliseconds = Date.parse(from);
  if (!Number.isFinite(startMilliseconds)) invalid("INVALID_CRON_FROM", "The from time must be an ISO date-time.");
  let cursor = new Date(startMilliseconds);
  cursor.setUTCSeconds(0, 0);
  cursor = new Date(cursor.getTime() + 60_000);
  const output: string[] = [];
  for (let step = 0; step < 527_000 && output.length < count; step += 1) {
    if (matchesCron(schedule, cursor)) output.push(cursor.toISOString());
    cursor = new Date(cursor.getTime() + 60_000);
  }
  if (output.length < count) invalid("CRON_NOT_FOUND", "No matching run was found within one local search year.");
  return output;
}

export function nextCronRunsInTimeZone(
  input: string,
  from: string,
  count: number,
  timeZone: string,
): Array<{ readonly utc: string; readonly local: string }> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) invalid("INVALID_CRON_COUNT", "Next-run count must be an integer from 1 through 20.");
  const schedule = parseCronExpression(input);
  const startMilliseconds = Date.parse(from);
  if (!Number.isFinite(startMilliseconds)) invalid("INVALID_CRON_FROM", "The from time must be an ISO date-time.");
  const formatter = cronTimeZoneFormatter(timeZone);
  let cursor = new Date(startMilliseconds);
  cursor.setUTCSeconds(0, 0);
  cursor = new Date(cursor.getTime() + 60_000);
  const output: Array<{ utc: string; local: string }> = [];
  for (let step = 0; step < 527_000 && output.length < count; step += 1) {
    const local = wallClock(formatter, cursor);
    if (matchesCronWallClock(schedule, local)) output.push({ utc: cursor.toISOString(), local: wallClockIso(local) });
    cursor = new Date(cursor.getTime() + 60_000);
  }
  if (output.length < count) invalid("CRON_NOT_FOUND", "No matching run was found within one local search year.");
  return output;
}

export function cronNextRunOperation(input: string, from: string, count: number, timeZone = "UTC"): DeveloperWebResult {
  const occurrences = nextCronRunsInTimeZone(input, from, count, timeZone);
  return {
    valid: true,
    expression: parseCronExpression(input).expression,
    from,
    count: occurrences.length,
    runs: occurrences.map(({ utc }) => utc),
    localRuns: occurrences,
    timezone: timeZone,
    dstPolicy: {
      gap: "skip-nonexistent-local-times",
      overlap: "include-each-distinct-utc-instant",
    },
    semantics: "Sintassi POSIX a cinque campi; DOM/DOW conserva la semantica OR quando entrambi sono limitati.",
  } as DeveloperWebResult;
}

export const lookupHttpStatus = httpStatusOperation;
export const lookupMimeType = mimeTypeOperation;
export const explainCron = explainCronOperation;
export const calculateNextCronRuns = nextCronRuns;
export const convertUnixTimestamp = unixTimestampOperation;
export const editQueryString = queryStringOperation;

export { HTTP_STATUSES, MIME_BY_EXTENSION, parseCronExpression, matchesCron };
