/**
 * Annual, full-calendar-year TFR estimate for Italian employees.
 * Art. 2120 c.c. (Legge 297/1982, art. 1): wage / 13.5 each year;
 * prior-year reserve revalued by 1.5% + 75% of positive annual December FOI growth.
 * The optional IVS 0.50% reduction is under Legge 297/1982, art. 3;
 * exemptions, months, advances, pension-fund transfers and tax are out of scope.
 */
export const TFR_15_SOURCES = [
  { authority: "Normattiva", title: "Legge 297/1982, articolo 1 (art. 2120 c.c.)", url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:1982-05-29;297" },
  { authority: "INPS", title: "Circolare 75/2024, riduzione IVS dello 0,50% e relativa esenzione", url: "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2024/06/Circolare_14611/Allegati/15195_Circolare-numero-75-del-28-06-2024.pdf" },
  { authority: "ANCE / ISTAT", title: "Coefficienti FOI dicembre 2024", url: "https://ance.it/2025/02/legge-29-maggio-1982-n-297-tfr-indice-istat-relativo-al-mese-di-dicembre-2024/" },
  { authority: "ISTAT", title: "Indice FOI dicembre 2025", url: "https://www.istat.it/comunicato-stampa/prezzi-al-consumo-dicembre-2025/" },
  { authority: "Assolombarda / ISTAT", title: "Coeff. TFR dicembre 2020: 1,500000% in deflazione", url: "https://www.assolombarda.it/servizi/informazioni-economiche/trattamento-di-fine-rapporto-tfr-nota-informativa-dicembre-2020" },
  { authority: "INPS", title: "Rivalutazione del TFR e imposta sostitutiva (Circolare 194/2014)", url: "https://servizi2.inps.it/servizi/Bussola/VisualizzaDoc.aspx?Accessibile=yes&iIDLink=-1&sVirtualURL=%2FCircolari%2FCircolare+numero+194+del+30-12-2014.htm" },
] as const;

export interface TfrAnnualInput15 {
  /** Full completed calendar year, from 1983 onward. */
  year: number;
  /** Gross eligible earnings, cents, not necessarily the employee's RAL. */
  eligibleGrossCents: number;
  /** Year-on-year percentage change of December FOI excluding tobacco; null when unknown. */
  foiGrowthPercent: number | null;
}

export interface TfrAnnualLine15 {
  year: number;
  annualAccrualCents: number;
  previousReserveCents: number | null;
  foiGrowthPercent: number | null;
  revaluationPercent: number | null;
  revaluationCents: number | null;
  yearEndGrossCents: number | null;
}

export interface TfrEstimate15 {
  status: "COMPLETE" | "PARTIAL";
  accruedGrossCents: number;
  totalRevaluationCents: number | null;
  grossTotalCents: number | null;
  lines: readonly TfrAnnualLine15[];
  missingFoiYears: readonly number[];
  contributionReductionPercent: number;
}

export function calculateTfr15(rows: readonly TfrAnnualInput15[], contributionReductionPercent = 0.5): TfrEstimate15 {
  if (rows.length < 1 || rows.length > 60 || !Number.isFinite(contributionReductionPercent) ||
      contributionReductionPercent < 0 || contributionReductionPercent > 0.5) {
    throw new Error("TFR_INPUT: servono 1–60 anni e una riduzione IVS tra 0 e 0,50%.");
  }
  let reserve: number | null = 0;
  let accruedGrossCents = 0;
  let totalRevaluationCents = 0;
  const missingFoiYears: number[] = [];
  const lines: TfrAnnualLine15[] = [];
  const lastCompletedYear = new Date().getFullYear() - 1;
  rows.forEach((row, index) => {
    if (!Number.isInteger(row.year) || row.year < 1983 || row.year > lastCompletedYear ||
        (index > 0 && row.year !== rows[index - 1]!.year + 1) ||
        !Number.isSafeInteger(row.eligibleGrossCents) || row.eligibleGrossCents < 0 || row.eligibleGrossCents > 1_000_000_000 ||
        (row.foiGrowthPercent !== null && (!Number.isFinite(row.foiGrowthPercent) || row.foiGrowthPercent < -100 || row.foiGrowthPercent > 100))) {
      throw new Error("TFR_INPUT: anni completi e consecutivi dal 1983, importi in centesimi e FOI percentuale valida.");
    }
    const annualAccrualCents = Math.round(row.eligibleGrossCents / 13.5 - row.eligibleGrossCents * contributionReductionPercent / 100);
    accruedGrossCents += annualAccrualCents;
    const previousReserveCents = reserve;
    let revaluationCents: number | null = 0;
    let revaluationPercent: number | null = null;
    if (index > 0) {
      if (row.foiGrowthPercent === null || reserve === null) {
        revaluationCents = null;
        if (row.foiGrowthPercent === null) missingFoiYears.push(row.year);
      } else {
        // The FOI component is an increase, floored at zero in deflationary years (e.g. 2020).
        revaluationPercent = 1.5 + 0.75 * Math.max(0, row.foiGrowthPercent);
        revaluationCents = Math.round(reserve * revaluationPercent / 100);
        totalRevaluationCents += revaluationCents;
      }
    }
    reserve = reserve === null || revaluationCents === null ? null : reserve + revaluationCents + annualAccrualCents;
    lines.push({ year: row.year, annualAccrualCents, previousReserveCents,
      foiGrowthPercent: index === 0 ? null : row.foiGrowthPercent, revaluationPercent,
      revaluationCents, yearEndGrossCents: reserve });
  });
  return { status: reserve === null ? "PARTIAL" : "COMPLETE", accruedGrossCents,
    totalRevaluationCents: reserve === null ? null : totalRevaluationCents,
    grossTotalCents: reserve, missingFoiYears, contributionReductionPercent, lines };
}

/** Semicolon-separated: year;eligible gross EUR;annual FOI growth %, blank for first year. */
export function parseTfrRows15(text: string): TfrAnnualInput15[] {
  const rawLines = text.trim().split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (rawLines.length < 1 || rawLines.length > 60) throw new Error("Inserisci da 1 a 60 righe, una per anno.");
  return rawLines.map((line) => {
    const parts = line.split(";").map((value) => value.trim());
    // FOI Dec/Dec derives from index ratios and may need more precision than an amount in EUR.
    const decimal = (value: string) => /^-?\d+(?:[.,]\d{1,10})?$/u.test(value) ? Number(value.replace(",", ".")) : NaN;
    if (parts.length !== 3 || !/^\d{4}$/u.test(parts[0]!) || parts[1] === "") {
      throw new Error("Ogni riga deve essere: anno; retribuzione lorda; variazione FOI (es. 2024;32000;1,1). ");
    }
    const grossEuro = decimal(parts[1]!);
    const foi = parts[2] === "" ? null : decimal(parts[2]!);
    if (!Number.isFinite(grossEuro) || Math.round(grossEuro * 100) / 100 !== grossEuro || (foi !== null && !Number.isFinite(foi))) {
      throw new Error("Controlla importi e percentuali: euro al massimo con due decimali; FOI con virgola o punto.");
    }
    return { year: Number(parts[0]), eligibleGrossCents: Math.round(grossEuro * 100), foiGrowthPercent: foi };
  });
}
