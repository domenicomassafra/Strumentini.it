import {
  ITALIAN_GEOGRAPHY_115_METADATA,
  lookupItalianGeography115,
  type ItalianGeographyCandidate115,
  type ItalianGeographyKind115,
} from "../../reference-data/italy/geography-115";

/**
 * #121 / DM Finanze 23 dicembre 1976, artt. 3-7 (GU n.345 del 29/12/1976).
 * https://def.finanze.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getSommario&id=%7B8D93A450-E5FE-47FC-A6F0-F938769051BF%7D
 *
 * Formal tests and deterministic local *candidates* are not assignments by
 * Agenzia delle Entrate and cannot prove someone's personal identity.
 * The #115 historical dataset does not establish birth-date validity intervals.
 */
export const CODICE_FISCALE_RULE_SOURCE_121 = Object.freeze({
  authority: "Ministero delle Finanze",
  act: "Decreto 23 dicembre 1976, n. 13813, articoli 3-7",
  url: "https://def.finanze.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getSommario&id=%7B8D93A450-E5FE-47FC-A6F0-F938769051BF%7D",
  geographyVersion: ITALIAN_GEOGRAPHY_115_METADATA.version,
  assignedByAuthority: false,
});

export type CodiceFiscaleError121 =
  | "INPUT_INVALID" | "NAME_UNSUPPORTED" | "INVALID_DATE" | "SEX_INVALID"
  | "GEOGRAPHY_INVALID_ID" | "GEOGRAPHY_NOT_IN_SNAPSHOT" | "GEOGRAPHY_CODE_UNAVAILABLE"
  | "GEOGRAPHY_AMBIGUOUS" | "GEOGRAPHY_TEMPORAL_UNVERIFIED"
  | "FORMAT_INVALID" | "STRUCTURE_INVALID" | "MONTH_INVALID" | "DATE_INVALID" | "CHECKSUM_MISMATCH";

export interface CodiceFiscalePerson121 {
  readonly surname: string;
  readonly name: string;
  readonly birthDate: string; // exactly YYYY-MM-DD
  readonly sex: "M" | "F";
  readonly birthPlace: { readonly kind: ItalianGeographyKind115; readonly istatCode: string };
}

export type CodiceFiscaleGeneration121 =
  | {
    readonly status: "GENERATED_CANDIDATE";
    readonly code: string;
    readonly geography: ItalianGeographyCandidate115;
    readonly geographyVersion: string;
    readonly geographyAtBirth: "SNAPSHOT_DATE_ONLY" | "NOT_VERIFIED";
    readonly identityConfirmed: false;
    readonly officialAssignment: false;
    readonly limitations: readonly string[];
  }
  | {
    readonly status: "REFUSED";
    readonly reasonCode: CodiceFiscaleError121;
    readonly reason: string;
    readonly identityConfirmed: false;
    readonly officialAssignment: false;
  };

export interface CodiceFiscaleOmocodiaPosition121 {
  readonly position: number; // legal 1-indexed character position
  readonly letter: string;
  readonly digit: string;
}

export type CodiceFiscaleValidation121 =
  | {
    readonly status: "INVALID";
    readonly reasonCode: CodiceFiscaleError121;
    readonly reason: string;
    readonly identityConfirmed: false;
  }
  | {
    readonly status: "FORMALLY_VALID";
    readonly normalizedCode: string;
    readonly canonicalCode: string;
    readonly nameToken: string;
    readonly surnameToken: string;
    readonly sex: "M" | "F";
    readonly month: number;
    readonly day: number;
    readonly yearSuffix: number;
    readonly possibleBirthDates: readonly string[];
    readonly centuryAmbiguous: boolean;
    readonly belfiore: string;
    readonly omocodia: readonly CodiceFiscaleOmocodiaPosition121[];
    readonly identityConfirmed: false;
    readonly officialAssignment: false;
  };

const MONTH_CODES = "ABCDEHLMPRST";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// 1-indexed odd character positions, 0=A and 0=0 match the same entry.
const ODD = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23] as const;
const OMOCODIA_DIGITS = "LMNPQRSTUV";
const NUMERIC_POSITIONS = new Set([6, 7, 9, 10, 12, 13, 14]); // zero-based
const STRUCTURE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/u;

const refusal = (reasonCode: CodiceFiscaleError121, reason: string): CodiceFiscaleGeneration121 => ({
  status: "REFUSED", reasonCode, reason, identityConfirmed: false, officialAssignment: false,
});
const invalid = (reasonCode: CodiceFiscaleError121, reason: string): CodiceFiscaleValidation121 => ({
  status: "INVALID", reasonCode, reason, identityConfirmed: false,
});

function parityValue(char: string, oddPosition: boolean): number {
  const asDigit = /^[0-9]$/u.test(char) ? Number(char) : LETTERS.indexOf(char);
  if (asDigit < 0) throw new Error("CF121_CHECKSUM_INPUT: carattere non alfanumerico");
  return oddPosition ? ODD[asDigit]! : asDigit;
}

/** Computes the exact 16th character on the original 15 characters, including omocodia letters. */
export function codiceFiscaleChecksum121(first15: string): string {
  if (typeof first15 !== "string" || !/^[A-Z0-9]{15}$/u.test(first15)) {
    throw new Error("CF121_CHECKSUM_INPUT: servono esattamente 15 caratteri ASCII alfanumerici maiuscoli");
  }
  let sum = 0;
  for (let i = 0; i < 15; i += 1) sum += parityValue(first15[i]!, i % 2 === 0);
  return LETTERS[sum % 26]!;
}

function asciiName(value: string): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 160 ||
    !/^[\p{Script=Latin}\p{Mark}\s'’\-]+$/u.test(value)) return null;
  const cleaned = value.normalize("NFD").replace(/\p{Mark}/gu, "").toUpperCase()
    .replace(/[\s'’\-]/gu, "");
  return /^[A-Z]+$/u.test(cleaned) ? cleaned : null;
}

function threeLetters(value: string, useNameRule: boolean): string {
  const consonants = value.replace(/[AEIOU]/gu, "");
  const vowels = value.replace(/[^AEIOU]/gu, "");
  if (useNameRule && consonants.length >= 4) return `${consonants[0]}${consonants[2]}${consonants[3]}`;
  return (consonants + vowels + "XXX").slice(0, 3);
}

function exactDateParts(value: string): { year: number; month: number; day: number } | null {
  if (typeof value !== "string" || !/^(?:19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined || !isValidDate(year, month, day)) return null;
  return { year, month, day };
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function decodeNumeric(char: string): { value: string; substitution: boolean } {
  if (/^[0-9]$/u.test(char)) return { value: char, substitution: false };
  const index = OMOCODIA_DIGITS.indexOf(char);
  if (index < 0) throw new Error("CF121_INTERNAL_INVALID_OMOCODIA");
  return { value: String(index), substitution: true };
}

export function validateCodiceFiscale121(code: string): CodiceFiscaleValidation121 {
  if (typeof code !== "string" || code.length !== 16 || !/^[A-Za-z0-9]{16}$/u.test(code)) {
    return invalid("FORMAT_INVALID", "Richiesti 16 caratteri alfanumerici ASCII, senza spazi.");
  }
  const normalizedCode = code.toUpperCase();
  if (!STRUCTURE.test(normalizedCode)) {
    if (normalizedCode.length === 16 && !MONTH_CODES.includes(normalizedCode[8]!)) {
      // Only valid month letters exist at index 8; other letters cannot be omocodia there.
      if (/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/u.test(normalizedCode)) {
        return invalid("MONTH_INVALID", "Lettera del mese non prevista dal decreto.");
      }
    }
    return invalid("STRUCTURE_INVALID", "Lettere di omocodia ammesse solo nelle sette posizioni numeriche.");
  }
  const replacements: CodiceFiscaleOmocodiaPosition121[] = [];
  const base = normalizedCode.slice(0, 15).split("");
  for (let index = 0; index < 15; index += 1) {
    if (!NUMERIC_POSITIONS.has(index)) continue;
    const decoded = decodeNumeric(base[index]!);
    if (decoded.substitution) replacements.push({ position: index + 1, letter: base[index]!, digit: decoded.value });
    base[index] = decoded.value;
  }
  const month = MONTH_CODES.indexOf(normalizedCode[8]!) + 1;
  const yy = Number(`${base[6]}${base[7]}`);
  const daySex = Number(`${base[9]}${base[10]}`);
  const sex = daySex > 40 ? "F" : "M";
  const day = sex === "F" ? daySex - 40 : daySex;
  if (daySex === 0 || (daySex > 31 && daySex < 41) || daySex > 71 || day < 1 || day > 31) {
    return invalid("DATE_INVALID", "Codifica del giorno/sesso impossibile.");
  }
  const possibleBirthDates = [1900 + yy, 2000 + yy].filter((year) => isValidDate(year, month, day))
    .map((year) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  if (possibleBirthDates.length === 0) {
    return invalid("DATE_INVALID", "Data impossibile nei secoli 1900 e 2000; nessun secolo viene inventato.");
  }
  const expected = codiceFiscaleChecksum121(normalizedCode.slice(0, 15));
  if (normalizedCode[15] !== expected) {
    return invalid("CHECKSUM_MISMATCH", `Carattere di controllo non coerente: atteso ${expected}.`);
  }
  const normalizedBody = base.join("");
  return {
    status: "FORMALLY_VALID", normalizedCode,
    canonicalCode: normalizedBody + codiceFiscaleChecksum121(normalizedBody),
    surnameToken: normalizedBody.slice(0, 3), nameToken: normalizedBody.slice(3, 6),
    sex, month, day, yearSuffix: yy, possibleBirthDates,
    centuryAmbiguous: possibleBirthDates.length > 1,
    belfiore: normalizedBody.slice(11, 15), omocodia: replacements,
    identityConfirmed: false, officialAssignment: false,
  };
}

export function generateCodiceFiscale121(input: CodiceFiscalePerson121): CodiceFiscaleGeneration121 {
  if (!input || !input.birthPlace || typeof input.birthPlace.istatCode !== "string" ||
    !["current", "suppressed", "foreign"].includes(input.birthPlace.kind)) {
    return refusal("INPUT_INVALID", "Campi personali o identificatore del luogo mancanti.");
  }
  const surname = asciiName(input.surname);
  const name = asciiName(input.name);
  if (!surname || !name) return refusal("NAME_UNSUPPORTED", "Nome e cognome devono essere traslitterabili senza perdita alla codifica latina ASCII supportata.");
  if (input.sex !== "M" && input.sex !== "F") return refusal("SEX_INVALID", "Sesso codificabile M o F non specificato.");
  const date = exactDateParts(input.birthDate);
  if (!date) return refusal("INVALID_DATE", "Data di nascita impossibile o fuori dall'intervallo esplicito 1900–2099.");
  const location = lookupItalianGeography115(input.birthPlace.kind, input.birthPlace.istatCode);
  if (location.status === "INVALID_IDENTIFIER") return refusal("GEOGRAPHY_INVALID_ID", "Codice territoriale ISTAT malformato.");
  if (location.status === "NOT_IN_SNAPSHOT") return refusal("GEOGRAPHY_NOT_IN_SNAPSHOT", "Luogo assente dagli snapshot ufficiali disponibili.");
  if (location.status === "OFFICIAL_CODE_UNAVAILABLE") return refusal("GEOGRAPHY_CODE_UNAVAILABLE", "Codice catastale ufficiale ND/assente: non viene dedotto dal comune successore.");
  const codes = [...new Set(location.candidates.map(({ belfiore }) => belfiore).filter((v): v is string => v !== null))];
  if (codes.length !== 1) return refusal("GEOGRAPHY_AMBIGUOUS", "Più codici incompatibili per lo stesso identificativo storico.");
  // #115 identifies a Belfiore code, but does not establish its validity for
  // arbitrary birth dates. A clearly labelled *candidate* is still useful:
  // absence of historical evidence must never be presented as confirmation.
  const geographyAtBirth = input.birthPlace.kind === "current" &&
    input.birthDate === ITALIAN_GEOGRAPHY_115_METADATA.currentMunicipalitiesAsOf
    ? "SNAPSHOT_DATE_ONLY" as const : "NOT_VERIFIED" as const;
  const first15 = threeLetters(surname, false) + threeLetters(name, true) + String(date.year).slice(-2)
    + MONTH_CODES[date.month - 1]!
    + String(date.day + (input.sex === "F" ? 40 : 0)).padStart(2, "0")
    + codes[0];
  const code = first15 + codiceFiscaleChecksum121(first15);
  return {
    status: "GENERATED_CANDIDATE", code,
    geography: { ...location.candidates[0]! }, geographyVersion: location.version, geographyAtBirth,
    identityConfirmed: false, officialAssignment: false,
    limitations: [
      "Codice calcolato localmente da dati dichiarati, non assegnato né verificato dall'Agenzia delle Entrate.",
      geographyAtBirth === "NOT_VERIFIED"
        ? "Il codice catastale è documentato nella fonte citata, ma la sua validità alla data di nascita non è verificata: controllare storicamente prima dell'uso."
        : "Il codice del Comune corrisponde allo snapshot ISTAT del 21/02/2026.",
      "Possibili omocodie e codici attribuiti dall'autorità non possono essere ricostruiti dai dati dichiarati.",
    ],
  };
}
