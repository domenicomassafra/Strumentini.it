import { ITALIAN_PASSPHRASE_WORDLIST } from "../../reference-data/italian-passphrase-v1";
import type { ToolModule } from "../../runtime/types";

const UINT32_RANGE = 0x1_0000_0000;
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!#$%&()*+,-./:;<=>?@[]^_{|}~";

export const PASSWORD_LENGTH_MIN = 8;
export const PASSWORD_LENGTH_MAX = 128;
export const PIN_LENGTH_MIN = 4;
export const PIN_LENGTH_MAX = 32;
export const PASSPHRASE_WORDS_MIN = 3;
export const PASSPHRASE_WORDS_MAX = 16;

export type RandomFill = (buffer: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

function webCryptoFill(buffer: Uint32Array<ArrayBuffer>): Uint32Array<ArrayBuffer> {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues === undefined) throw new Error("WEBCRYPTO_UNAVAILABLE");
  return cryptoApi.getRandomValues(buffer);
}

function boundedInteger(value: unknown, minimum: number, maximum: number, error: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(error);
  return parsed;
}

export function unbiasedRandomIndex(limit: number, fill: RandomFill = webCryptoFill): number {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > UINT32_RANGE) throw new Error("RANDOM_LIMIT_INVALID");
  const acceptedBelow = Math.floor(UINT32_RANGE / limit) * limit;
  const buffer = new Uint32Array(new ArrayBuffer(4));
  for (let attempt = 0; attempt < 1024; attempt += 1) {
    fill(buffer);
    const value = buffer[0] ?? 0;
    if (value < acceptedBelow) return value % limit;
  }
  throw new Error("RANDOM_SOURCE_REJECTION_LIMIT");
}

function pick(alphabet: string, fill: RandomFill): string {
  return alphabet[unbiasedRandomIndex(alphabet.length, fill)] ?? "";
}

function shuffle(values: string[], fill: RandomFill): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = unbiasedRandomIndex(index + 1, fill);
    [values[index], values[other]] = [values[other] ?? "", values[index] ?? ""];
  }
}

export interface PasswordGeneratorOptions {
  readonly length: number;
  readonly lowercase: boolean;
  readonly uppercase: boolean;
  readonly digits: boolean;
  readonly symbols: boolean;
}

export function generatePassword(options: PasswordGeneratorOptions, fill: RandomFill = webCryptoFill): string {
  const length = boundedInteger(options.length, PASSWORD_LENGTH_MIN, PASSWORD_LENGTH_MAX, "PASSWORD_LENGTH_INVALID");
  const selected = [
    options.lowercase ? LOWER : "",
    options.uppercase ? UPPER : "",
    options.digits ? DIGITS : "",
    options.symbols ? SYMBOLS : "",
  ].filter((value) => value.length > 0);
  if (selected.length === 0) throw new Error("PASSWORD_CHARACTER_SET_REQUIRED");
  if (length < selected.length) throw new Error("PASSWORD_LENGTH_TOO_SHORT_FOR_SETS");

  const alphabet = selected.join("");
  const output = selected.map((set) => pick(set, fill));
  while (output.length < length) output.push(pick(alphabet, fill));
  shuffle(output, fill);
  return output.join("");
}

export function generatePin(lengthValue: number, fill: RandomFill = webCryptoFill): string {
  const length = boundedInteger(lengthValue, PIN_LENGTH_MIN, PIN_LENGTH_MAX, "PIN_LENGTH_INVALID");
  let output = "";
  for (let index = 0; index < length; index += 1) output += String(unbiasedRandomIndex(10, fill));
  return output;
}

const PASSPHRASE_SEPARATORS = new Set(["-", ".", "_", " "]);

export function generateItalianPassphrase(wordCountValue: number, separator = "-", fill: RandomFill = webCryptoFill): string {
  const wordCount = boundedInteger(wordCountValue, PASSPHRASE_WORDS_MIN, PASSPHRASE_WORDS_MAX, "PASSPHRASE_WORD_COUNT_INVALID");
  if (!PASSPHRASE_SEPARATORS.has(separator)) throw new Error("PASSPHRASE_SEPARATOR_INVALID");
  const words: string[] = [];
  for (let index = 0; index < wordCount; index += 1) {
    words.push(ITALIAN_PASSPHRASE_WORDLIST.words[unbiasedRandomIndex(ITALIAN_PASSPHRASE_WORDLIST.words.length, fill)] ?? "");
  }
  return words.join(separator);
}

export interface GeneratedSecret {
  readonly mode: "password" | "pin" | "passphrase";
  readonly secret: string;
  readonly provenance: string;
  readonly wordlist?: {
    readonly id: string;
    readonly version: string;
    readonly wordCount: number;
    readonly provenance: string;
  };
}

export function generateSecret(input: unknown, fill: RandomFill = webCryptoFill): GeneratedSecret {
  if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT");
  const record = input as Record<string, unknown>;
  const mode = record.mode;
  if (mode === "password") {
    const secret = generatePassword({
      length: boundedInteger(record.length, PASSWORD_LENGTH_MIN, PASSWORD_LENGTH_MAX, "PASSWORD_LENGTH_INVALID"),
      lowercase: record.lowercase !== false,
      uppercase: record.uppercase !== false,
      digits: record.digits !== false,
      symbols: record.symbols === true,
    }, fill);
    return { mode, secret, provenance: "Generato localmente con WebCrypto e selezione uniforme tramite rejection sampling." };
  }
  if (mode === "pin") {
    return {
      mode,
      secret: generatePin(boundedInteger(record.length, PIN_LENGTH_MIN, PIN_LENGTH_MAX, "PIN_LENGTH_INVALID"), fill),
      provenance: "Generato localmente con WebCrypto e selezione uniforme delle cifre tramite rejection sampling.",
    };
  }
  if (mode === "passphrase") {
    const wordCount = boundedInteger(record.wordCount, PASSPHRASE_WORDS_MIN, PASSPHRASE_WORDS_MAX, "PASSPHRASE_WORD_COUNT_INVALID");
    const separator = typeof record.separator === "string" ? record.separator : "-";
    return {
      mode,
      secret: generateItalianPassphrase(wordCount, separator, fill),
      provenance: "Parole scelte localmente con WebCrypto e rejection sampling dalla lista italiana versionata indicata qui sotto.",
      wordlist: {
        id: ITALIAN_PASSPHRASE_WORDLIST.id,
        version: ITALIAN_PASSPHRASE_WORDLIST.version,
        wordCount: ITALIAN_PASSPHRASE_WORDLIST.words.length,
        provenance: ITALIAN_PASSPHRASE_WORDLIST.provenance,
      },
    };
  }
  throw new Error("GENERATOR_MODE_INVALID");
}

const module: ToolModule = {
  run(input) {
    return generateSecret(input);
  },
};

export default module;
