import type { ToolModule } from "../../runtime/types";
import type { DonorSummary } from "./donor-core";

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

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

function estimateInWorker(password: string, signal?: AbortSignal): Promise<DonorSummary> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./donor-worker.ts", import.meta.url), { type: "module" });
    } catch (cause) {
      reject(cause);
      return;
    }
    const finish = () => {
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };
    const onAbort = () => {
      finish();
      reject(new DOMException("Operation cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: DonorSummary; error?: string }>) => {
      finish();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error("DONOR_UNAVAILABLE"));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("DONOR_UNAVAILABLE"));
    };
    if (signal?.aborted) onAbort();
    else worker.postMessage({ password });
  });
}

/** Lazily evaluate the donor, keeping the original estimator as a reversible fallback. */
export async function estimatePasswordStrengthWithDonor(password: string, signal?: AbortSignal): Promise<PasswordStrengthResult> {
  abortIfNeeded(signal);
  // Validate before loading any assets or giving work to a worker.
  const previous = estimatePasswordStrength(password);
  let donor: DonorSummary;
  try {
    donor = typeof Worker !== "undefined"
      ? await estimateInWorker(password, signal)
      : (await import("./donor-core")).estimateDonor(password);
  } catch (cause) {
    abortIfNeeded(signal);
    // CSP, unsupported workers or a missing chunk must not break local usage.
    return previous;
  }
  abortIfNeeded(signal);
  const score = Math.min(previous.score, donor.score) as PasswordStrengthResult["score"];
  const factors: StrengthFactor[] = [...previous.factors];
  if (donor.patterns.includes("dictionary") || donor.patterns.includes("wordSequence")) {
    factors.push({ kind: "warning", code: "donor-dictionary", detail: "Sono riconoscibili parole o schemi di dizionario, anche italiano; l'analisi locale ne tiene conto senza mostrare le parole trovate." });
  }
  if (donor.patterns.includes("spatial") || donor.patterns.includes("date")) {
    factors.push({ kind: "warning", code: "donor-pattern", detail: "L'analisi locale riconosce anche sequenze di tastiera o date prevedibili." });
  }
  factors.push({
    kind: "limit", code: "donor-model",
    detail: "Stima di zxcvbn-ts combinata in modo prudente con il modello precedente; il donor analizza al massimo le prime 256 unità UTF-16.",
  });
  return {
    ...previous,
    score,
    label: (["molto debole", "debole", "discreta", "buona", "molto buona"] as const)[score],
    factors,
    limitations: [
      "Stima locale da lunghezza, pattern e dizionari generici, senza garanzie di sicurezza.",
      ...previous.limitations.slice(1),
    ],
  };
}

const module: ToolModule = {
  run(input, _context, signal) {
    if (typeof input !== "object" || input === null || typeof (input as { password?: unknown }).password !== "string") {
      throw new Error("PASSWORD_REQUIRED");
    }
    return estimatePasswordStrengthWithDonor((input as { password: string }).password, signal);
  },
};

export default module;
