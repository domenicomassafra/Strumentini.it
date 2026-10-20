/** Formal checks only. Registry existence is a separate, opt-in verification. */
export function partitaIvaResultRows(result: Readonly<Record<string, unknown>>): readonly (readonly [string, unknown])[] {
  return [
    ["Partita IVA normalizzata", result.normalized],
    ["Paese IVA", result.countryCode],
    ["Formato nazionale verificato", result.formatValid],
    ["Regola non superata", result.failureRule],
    ["Motivo", result.reason],
    ["Cifra di controllo inserita", result.checkDigit],
    ["Cifra di controllo attesa", result.expectedCheckDigit],
    ["Esistenza nel registro verificata", result.registerVerified],
  ];
}
