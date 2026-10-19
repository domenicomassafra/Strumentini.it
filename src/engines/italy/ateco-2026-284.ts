/**
 * #284: bounded ATECO2025→ATECO2007 (2022 revision) correspondences.
 * ISTAT 2026 correspondence workbook, sheet "ATECO 2025 vs ATECO 2022":
 * https://www.istat.it/wp-content/uploads/2026/07/Aggiornamento-2026-Tavola-raccordo-bidirezionale-ATECO-2025-ATECO-2022-italiano.xlsx
 * sha256:faf4530a869f1e3d6b68f464520dcddd691f4565d17e92e3988370cf3c808673
 * Only TOTAL/TOTAL, 1:1 six-digit correspondences are explicitly admitted.
 * A statistical correspondence is not proof of a taxpayer's actual activity.
 */
import { getForfettarioAteco2007Coefficient133 } from "./forfettario-133";

// [ATECO2025, ATECO2007/2022]. These are exact rows independently read
// from the pinned ISTAT workbook; deliberately no prefix or 78% fallback.
const VERIFIED_ATECO_2026_284 = [
  ["01.12.00", "01.12.00"],
  ["10.11.00", "10.11.00"],
  ["43.11.00", "43.11.00"],
  ["43.13.00", "43.13.00"],
  ["56.11.11", "56.10.11"],
  ["56.11.91", "56.10.12"],
  ["70.20.01", "70.22.01"],
  ["74.12.01", "74.10.21"],
  ["74.30.00", "74.30.00"],
  ["96.21.00", "96.02.01"],
] as const;

export const ATECO_2026_284_SOURCE = Object.freeze({
  year: 2026, atecoVersion: "ATECO2025", checkedAt: "2026-10-19",
  effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31",
  officialTableSha256: "faf4530a869f1e3d6b68f464520dcddd691f4565d17e92e3988370cf3c808673",
  correspondenceCount: VERIFIED_ATECO_2026_284.length,
  status: "BOUNDED_1_TO_1_CORRESPONDENCES_ONLY" as const,
});

export function resolveForfettarioAteco2026_284(version: string, code: string) {
  if (version !== "ATECO2025" || !/^\d{2}\.\d{2}\.\d{2}$/u.test(code)) {
    throw new Error("FORF284_ATECO2025_EXACT_CODE_REQUIRED");
  }
  const entry = VERIFIED_ATECO_2026_284.find(([ateco2025]) => ateco2025 === code);
  if (!entry) throw new Error("FORF284_UNVERIFIED_ATECO_CORRESPONDENCE");
  const coefficient = getForfettarioAteco2007Coefficient133(entry[1]);
  if (!coefficient) throw new Error("FORF284_OFFICIAL_COEFFICIENT_MISSING");
  return { ateco2025Code: code, correspondingAteco2007Code: entry[1],
    ...coefficient, source: ATECO_2026_284_SOURCE };
}
