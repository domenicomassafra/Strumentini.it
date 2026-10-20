import {
  austria, belgium, bulgaria, croatia, cyprus, czechRepublic, denmark, estonia,
  finland, france, germany, greece, hungary, ireland, latvia, lithuania,
  luxembourg, malta, netherlands, poland, portugal, romania, slovakiaRepublic,
  slovenia, spain, sweden, unitedKingdom, checkVAT, type Country,
} from "vat-validation";
import { normalizePartitaIva } from "../../engines/research-reference";

// National EU VAT prefixes; XI covers Northern Ireland for intra-EU goods.
// EL is the Greek VAT prefix (the ISO country code GR is not a VAT prefix).
const EU_VAT_COUNTRIES: Readonly<Record<string, Country>> = {
  AT: austria, BE: belgium, BG: bulgaria, CY: cyprus, CZ: czechRepublic,
  DE: germany, DK: denmark, EE: estonia, EL: greece, ES: spain,
  FI: finland, FR: france, HR: croatia, HU: hungary, IE: ireland,
  LT: lithuania, LU: luxembourg, LV: latvia, MT: malta, NL: netherlands,
  PL: poland, PT: portugal, RO: romania, SE: sweden, SI: slovenia,
  SK: slovakiaRepublic, XI: unitedKingdom,
};

/** Local-only, formal EU extension. Unprefixed/IT input keeps the original Italian contract. */
export function validateEuVat(value: string) {
  const normalized = value.trim().replace(/\s/gu, "").toUpperCase();
  const prefix = /^[A-Z]{2}/u.exec(normalized)?.[0];
  if (prefix === undefined || prefix === "IT") {
    return { ...normalizePartitaIva(value), countryCode: "IT" };
  }

  const base = {
    kind: "PARTITA_IVA" as const,
    normalized,
    countryCode: prefix,
    claim: "formal-only" as const,
    registerVerified: false as const,
  };
  const country = Object.hasOwn(EU_VAT_COUNTRIES, prefix) ? EU_VAT_COUNTRIES[prefix] : undefined;
  if (country === undefined) {
    return { ...base, valid: false, failureRule: "country", reason: "Prefisso IVA UE non supportato (per la Grecia usa EL)." };
  }
  if (!/^[A-Z0-9]+$/u.test(normalized)) {
    return { ...base, valid: false, failureRule: "character", reason: "Sono ammessi solo lettere e cifre, oltre agli spazi di presentazione." };
  }
  if (normalized.length === 2) {
    return { ...base, valid: false, failureRule: "incomplete", reason: "Manca il numero dopo il prefisso nazionale." };
  }

  const checked = checkVAT(normalized, [country], { strict: true });
  if (!checked.isValidFormat) {
    return { ...base, valid: false, formatValid: false, failureRule: "format", reason: "Formato nazionale errato o incompleto: verifica lunghezza e caratteri richiesti." };
  }
  if (!checked.isValid) {
    return { ...base, valid: false, formatValid: true, failureRule: "national-rule", reason: "Formato corretto, ma controllo matematico nazionale non superato." };
  }
  return { ...base, valid: true, formatValid: true };
}
