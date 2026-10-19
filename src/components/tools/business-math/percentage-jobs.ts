import type { PercentageMode } from "../../../engines/business-math";

type InputName = "base" | "amount" | "ratePercent" | "rates";

interface JobField {
  readonly name: InputName;
  readonly label: string;
  readonly value: string;
}

export interface PercentageJob {
  readonly mode: PercentageMode;
  readonly label: string;
  readonly fields: readonly JobField[];
  readonly answerLabel: string;
  readonly example: string;
  readonly formula: string;
  readonly inverse: PercentageMode;
}

export const percentageJobs: readonly PercentageJob[] = [
  {
    mode: "of", label: "Quanto vale X% di Y?",
    fields: [{ name: "ratePercent", label: "X: percentuale (%)", value: "25" }, { name: "base", label: "Y: valore di riferimento", value: "80" }],
    answerLabel: "Quota calcolata", example: "Il 25% di 80 vale 20.",
    formula: "quota = Y × X / 100", inverse: "what-percent",
  },
  {
    mode: "what-percent", label: "X è quale percentuale di Y?",
    fields: [{ name: "amount", label: "X: parte", value: "20" }, { name: "base", label: "Y: totale", value: "80" }],
    answerLabel: "Percentuale sul totale", example: "20 rispetto a 80 è il 25%.",
    formula: "percentuale = X / Y × 100 (Y diverso da zero)", inverse: "of",
  },
  {
    mode: "increase", label: "Aumento percentuale",
    fields: [{ name: "base", label: "Valore iniziale", value: "80" }, { name: "ratePercent", label: "Aumento (%)", value: "25" }],
    answerLabel: "Valore aumentato", example: "80 aumentato del 25% diventa 100.",
    formula: "nuovo = iniziale × (1 + aumento / 100)", inverse: "reverse",
  },
  {
    mode: "reverse", label: "Valore prima di un aumento",
    fields: [{ name: "base", label: "Valore dopo l'aumento", value: "100" }, { name: "ratePercent", label: "Aumento applicato (%)", value: "25" }],
    answerLabel: "Valore iniziale", example: "100 dopo un aumento del 25% deriva da 80.",
    formula: "iniziale = nuovo / (1 + aumento / 100)", inverse: "increase",
  },
  {
    mode: "decrease", label: "Diminuzione o sconto",
    fields: [{ name: "base", label: "Valore iniziale", value: "80" }, { name: "ratePercent", label: "Riduzione (%)", value: "25" }],
    answerLabel: "Valore ridotto", example: "80 ridotto del 25% diventa 60.",
    formula: "nuovo = iniziale × (1 − riduzione / 100)", inverse: "reverse-discount",
  },
  {
    mode: "reverse-discount", label: "Prezzo prima dello sconto",
    fields: [{ name: "base", label: "Prezzo scontato", value: "60" }, { name: "ratePercent", label: "Sconto applicato (%)", value: "25" }],
    answerLabel: "Prezzo originale", example: "60 dopo uno sconto del 25% deriva da 80.",
    formula: "originale = scontato / (1 − sconto / 100); sconto da 0% a meno di 100%", inverse: "decrease",
  },
  {
    mode: "variation", label: "Variazione tra due valori",
    fields: [{ name: "base", label: "Valore iniziale", value: "80" }, { name: "amount", label: "Valore finale", value: "100" }],
    answerLabel: "Variazione percentuale", example: "Da 80 a 100: +25%. Invertendo i valori: −20%.",
    formula: "variazione = (finale − iniziale) / iniziale × 100 (iniziale diverso da zero)", inverse: "variation",
  },
  {
    mode: "cascade", label: "Sconti successivi",
    fields: [{ name: "base", label: "Prezzo originale", value: "100" }, { name: "rates", label: "Sconti (%) separati da ;", value: "10; 20" }],
    answerLabel: "Prezzo scontato finale", example: "100 con sconti del 10% e poi del 20% diventa 72 (28% effettivo).",
    formula: "finale = originale × prodotto di (1 − sconto / 100)", inverse: "reverse-cascade",
  },
  {
    mode: "reverse-cascade", label: "Prezzo prima di più sconti",
    fields: [{ name: "base", label: "Prezzo dopo tutti gli sconti", value: "72" }, { name: "rates", label: "Sconti (%) separati da ;", value: "10; 20" }],
    answerLabel: "Prezzo originale", example: "72 dopo sconti del 10% e 20% deriva da 100.",
    formula: "originale = finale / prodotto di (1 − sconto / 100); ogni sconto inferiore al 100%", inverse: "cascade",
  },
];
