import { INVOICE_STAMP_REFERENCE_2024_117 } from "../../reference-data/italy/fiscal-annual-117";

export interface InvoiceStampReferenceInput152 {
  readonly sourceYear: number;
  readonly ordinarySingleLine: boolean;
  readonly amountCents: number;
  readonly nature: string;
  /** Explicit declaration from user; no eligibility inference. */
  readonly declaresNoSpecialExemptions: boolean;
}

/** Strictly bounded reference of the 2024 Agenzia Elenco B heuristic; not a tax assessment. */
export function getInvoiceStampReference152(input: InvoiceStampReferenceInput152) {
  const pack = INVOICE_STAMP_REFERENCE_2024_117;
  const provenance = { sourceYear: pack.year, source: pack.source, limitation: "Agenzia 2024 Elenco B reference only; no legal assessment or current-year certification" };
  if (input.sourceYear !== pack.year || !input.ordinarySingleLine || !input.declaresNoSpecialExemptions
    || !pack.supportedNatures.some((nature) => nature === input.nature)) {
    return { ...provenance, state: "OUT_OF_SCOPE" as const, referenceStampCents: null };
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) {
    throw new Error("STAMP152_INVALID_AMOUNT: nonnegative integer euro cents required");
  }
  return { ...provenance, state: "REFERENCE" as const,
    referenceStampCents: input.amountCents > pack.thresholdCentsExclusive ? pack.stampCents : 0,
    isLegalCertification: false as const };
}
