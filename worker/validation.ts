/**
 * Input validation and the Italian copy shown to end users.
 *
 * Every user-facing string lives here so the API can be localized in one
 * place. Validation functions accept `unknown` and never throw.
 */

/** Conservative pattern: one `@`, no spaces, a dotted domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;
export const NAME_MAX_LENGTH = 80;
export const TOOL_ID_MAX_LENGTH = 64;

/** Tool ids are catalog slugs: lowercase words joined by single hyphens. */
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const MESSAGES = {
  invalidBody: "Richiesta non valida.",
  emailInvalid: "Inserisci un indirizzo email valido.",
  nameInvalid: "Inserisci un nome valido.",
  passwordInvalid: "Inserisci una password valida.",
  passwordTooShort: `La password deve contenere almeno ${String(PASSWORD_MIN_LENGTH)} caratteri.`,
  passwordTooLong: `La password non può superare ${String(PASSWORD_MAX_LENGTH)} caratteri.`,
  nameTooLong: `Il nome non può superare ${String(NAME_MAX_LENGTH)} caratteri.`,
  currentPasswordRequired: "Inserisci la password attuale.",
  toolIdInvalid: "Identificativo dello strumento non valido.",
  invalidCredentials: "Email o password non corretti.",
  emailTaken: "Esiste già un account con questa email.",
  currentPasswordWrong: "La password attuale non è corretta.",
  unauthenticated: "Sessione non valida o scaduta.",
  sessionNotFound: "Sessione non trovata.",
  notFound: "Risorsa non trovata.",
  methodNotAllowed: "Metodo non consentito.",
  payloadTooLarge: "Richiesta troppo grande.",
  rateLimited: "Troppi tentativi. Riprova più tardi.",
  turnstileRequired: "Completa la verifica anti-bot e riprova.",
  turnstileInvalid: "La verifica anti-bot non è valida o è scaduta. Riprova.",
  turnstileUnavailable: "La verifica anti-bot non è disponibile in questo momento. Riprova tra poco.",
  internal: "Errore interno del server.",
} as const;

export type Validation<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

function isValid(value: string): { readonly ok: true; readonly value: string } {
  return { ok: true, value };
}

function isInvalid(message: string): { readonly ok: false; readonly message: string } {
  return { ok: false, message };
}

/** Lowercases and trims an email; returns `null` when the input is not a string. */
export function normalizeEmail(raw: unknown): string | null {
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
}

export function validateEmail(raw: unknown): Validation<string> {
  const email = normalizeEmail(raw);
  if (email === null) return isInvalid(MESSAGES.emailInvalid);
  if (email === "" || email.length > 254 || !EMAIL_PATTERN.test(email)) return isInvalid(MESSAGES.emailInvalid);
  return isValid(email);
}

/** Trims a display name; empty names are rejected at registration time. */
export function validateName(raw: unknown): Validation<string> {
  if (typeof raw !== "string") return isInvalid(MESSAGES.nameInvalid);
  const name = raw.trim();
  if (name === "") return isInvalid(MESSAGES.nameInvalid);
  if (name.length > NAME_MAX_LENGTH) return isInvalid(MESSAGES.nameTooLong);
  if (/[\u0000-\u001F\u007F]/u.test(name)) return isInvalid(MESSAGES.nameInvalid);
  return isValid(name);
}

export function validatePassword(raw: unknown): Validation<string> {
  if (typeof raw !== "string" || raw === "") return isInvalid(MESSAGES.passwordInvalid);
  if (raw.length < PASSWORD_MIN_LENGTH) return isInvalid(MESSAGES.passwordTooShort);
  if (raw.length > PASSWORD_MAX_LENGTH) return isInvalid(MESSAGES.passwordTooLong);
  return isValid(raw);
}

/** Validates a tool id taken from a URL path segment. */
export function validateToolId(raw: unknown): Validation<string> {
  if (typeof raw !== "string") return isInvalid(MESSAGES.toolIdInvalid);
  const toolId = raw.trim();
  if (toolId === "" || toolId.length > TOOL_ID_MAX_LENGTH) return isInvalid(MESSAGES.toolIdInvalid);
  if (!TOOL_ID_PATTERN.test(toolId)) return isInvalid(MESSAGES.toolIdInvalid);
  return isValid(toolId);
}
