import type { ToolModule } from "../../runtime/types";

export const PASSWORD_STRENGTH_MAX_LENGTH = 1024;

export interface StrengthFactor {
  readonly kind: "positive" | "warning" | "limit";
  readonly code: string;
  readonly detail: string;
}

export interface PasswordStrengthResult {
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly label: "molto debole" | "debole" | "discreta" | "buona" | "molto buona";
  readonly length: number;
  readonly characterClasses: number;
  readonly factors: readonly StrengthFactor[];
  readonly limitations: readonly string[];
}

const COMMON_PATTERNS = [
  "password", "passw0rd", "qwerty", "1234", "abcd", "admin", "letmein", "welcome", "benvenuto", "ciao", "amore",
] as const;

function hasSequence(value: string): boolean {
  const normalized = value.toLocaleLowerCase("en-US");
  for (let start = 0; start <= normalized.length - 4; start += 1) {
    const codes = [...normalized.slice(start, start + 4)].map((char) => char.codePointAt(0) ?? 0);
    if (codes.length !== 4) continue;
    const ascending = codes.every((code, index) => index === 0 || code === (codes[index - 1] ?? 0) + 1);
    const descending = codes.every((code, index) => index === 0 || code === (codes[index - 1] ?? 0) - 1);
    if (ascending || descending) return true;
  }
  return false;
}

function characterClassCount(value: string): number {
  return [/[a-z]/u, /[A-Z]/u, /[0-9]/u, /[^A-Za-z0-9]/u].filter((pattern) => pattern.test(value)).length;
}

function labelFor(score: number): PasswordStrengthResult["label"] {
  return (["molto debole", "debole", "discreta", "buona", "molto buona"] as const)[score] ?? "molto debole";
}

export function estimatePasswordStrength(password: string): PasswordStrengthResult {
  if (typeof password !== "string") throw new Error("PASSWORD_REQUIRED");
  // JavaScript string length counts UTF-16 code units. Two code units per code
  // point is the maximum, so this cheap bound rejects impossible inputs before
  // materializing the code-point array used by the public length contract.
  if (password.length > PASSWORD_STRENGTH_MAX_LENGTH * 2) throw new Error("PASSWORD_TOO_LONG");
  const factors: StrengthFactor[] = [];
  const length = [...password].length;
  if (length > PASSWORD_STRENGTH_MAX_LENGTH) throw new Error("PASSWORD_TOO_LONG");
  const classes = characterClassCount(password);

  let score = length >= 24 ? 4 : length >= 16 ? 3 : length >= 12 ? 2 : length >= 8 ? 1 : 0;
  factors.push(length >= 16
    ? { kind: "positive", code: "length", detail: `Lunghezza ${length}: la lunghezza aumenta lo spazio delle combinazioni possibili.` }
    : { kind: "warning", code: "length", detail: `Lunghezza ${length}: una password più lunga riduce la facilità di tentativi esaustivi.` });

  if (length > 0) {
    factors.push({
      kind: "limit",
      code: "classes",
      detail: `${classes} classi di caratteri osservate. La composizione non aggiunge né sottrae punti: la stima locale usa soprattutto lunghezza e pattern osservabili.`,
    });
  }

  if (/(.)\1{2,}/u.test(password)) {
    score -= 1;
    factors.push({ kind: "warning", code: "repetition", detail: "Contiene almeno tre caratteri uguali consecutivi; viene applicata una penalità per ripetizione." });
  }
  if (/(.{2,})\1/u.test(password)) {
    score -= 1;
    factors.push({ kind: "warning", code: "repeated-block", detail: "Contiene un blocco di almeno due caratteri ripetuto consecutivamente; viene applicata una penalità." });
  }
  if (hasSequence(password)) {
    score -= 1;
    factors.push({ kind: "warning", code: "sequence", detail: "Contiene una sequenza crescente o decrescente di almeno quattro caratteri; viene applicata una penalità." });
  }
  const lower = password.toLocaleLowerCase("en-US");
  const matchedCommon = COMMON_PATTERNS.find((pattern) => lower.includes(pattern));
  if (matchedCommon !== undefined) {
    score -= 2;
    factors.push({ kind: "warning", code: "common-pattern", detail: `Contiene il modello comune “${matchedCommon}”; il modello applica una penalità maggiore.` });
  }

  const bounded = Math.max(0, Math.min(4, score)) as PasswordStrengthResult["score"];
  const limitations = [
    "È una stima locale basata su lunghezza e pattern osservabili, non una garanzia di sicurezza.",
    "Non consulta database di password violate e non afferma che la password sia presente o assente in una violazione.",
    "Il piccolo elenco di pattern comuni serve solo a spiegare la stima locale e non sostituisce una blocklist di password comuni o compromesse.",
    "Non normalizza Unicode prima di contare o stimare: rappresentazioni canoniche diverse possono quindi produrre lunghezze o punteggi diversi.",
    "Non conosce contesto personale, riuso su altri servizi, limiti di tentativi o qualità dell'autenticazione del sito.",
  ] as const;
  factors.push({ kind: "limit", code: "offline-limit", detail: limitations[1] });
  return { score: bounded, label: labelFor(bounded), length, characterClasses: classes, factors, limitations };
}

const module: ToolModule = {
  run(input) {
    if (typeof input !== "object" || input === null || typeof (input as { password?: unknown }).password !== "string") {
      throw new Error("PASSWORD_REQUIRED");
    }
    return estimatePasswordStrength((input as { password: string }).password);
  },
};

export default module;
