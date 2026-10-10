import { findAnprHistoricalBelfiore115 } from "../../reference-data/italy/geography-115-anpr-history";
import { decodeCodiceFiscale122 } from "./codice-fiscale-122";

/** Supplements #122 with *dated* archival place candidates, preserving both birth-century hypotheses. */
export function decodeCodiceFiscaleWithAnpr122(code: string) {
  const decoded = decodeCodiceFiscale122(code);
  if (decoded.status === "INVALID") return decoded;
  const dateScopedCandidates = decoded.possibleBirthDates.flatMap((birthDateHypothesis) => {
    const match = findAnprHistoricalBelfiore115(decoded.belfiore, birthDateHypothesis);
    if (match.status !== "OFFICIAL_ADMINISTRATIVE_INTERVAL_MATCH") return [];
    return match.candidates.map((candidate) => ({
      birthDateHypothesis,
      istatCode: candidate.istatCode, name: candidate.name, belfiore: candidate.belfiore,
      validFrom: candidate.validFrom, validTo: candidate.validTo,
      sourceRow: candidate.sourceRow, provenance: candidate.source, sourceVersion: match.version,
      confirmedAtAdministrativeDate: true as const,
    }));
  });
  return {
    ...decoded, status: "DECODED_WITH_ANPR_CANDIDATES" as const, dateScopedCandidates,
    identityConfirmed: false as const, officialAssignment: false as const,
    limitations: [
      ...decoded.limitations,
      "ANPR historical candidates refer only to archive administrative intervals through 2023-10-03; no certified identity, personal birth date or official CF assignment is determined.",
    ],
  };
}
