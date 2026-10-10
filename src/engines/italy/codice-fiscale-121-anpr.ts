import { lookupAnprHistoricalMunicipality115 } from "../../reference-data/italy/geography-115-anpr-history";

/** Supplemental #121 birth-place proof only. No CF generation/identity claim. */
export function verifyCodiceFiscaleBirthPlace121(input: {
  readonly kind: "current" | "suppressed" | "foreign";
  readonly istatCode: string;
  readonly birthDate: string;
}) {
  if (input.kind === "foreign") {
    return { status: "REFUSED_UNVERIFIED_GEOGRAPHY" as const, belfiore: null, assignedByAgency: false as const,
      reason: "The ANPR historical municipality source does not cover foreign-state CODAT histories." };
  }
  const match = lookupAnprHistoricalMunicipality115(input.istatCode, input.birthDate);
  if (match.status !== "OFFICIAL_ADMINISTRATIVE_INTERVAL_MATCH" || match.candidates.length !== 1) {
    return { status: "REFUSED_UNVERIFIED_GEOGRAPHY" as const, belfiore: null, assignedByAgency: false as const,
      reason: `Historical ANPR coverage not safely unique for ${input.istatCode} at ${input.birthDate}: ${match.status}` };
  }
  return {
    status: "HISTORICAL_ADMINISTRATIVE_CODE_VERIFIED" as const,
    belfiore: match.candidates[0]!.belfiore,
    administrativeInterval: { from: match.candidates[0]!.validFrom, to: match.candidates[0]!.validTo },
    source: match.source, sourceVersion: match.version, sourceRow: match.candidates[0]!.sourceRow,
    assignedByAgency: false as const,
    limitation: "ANPR verifies a code on an administrative date, never official Codice Fiscale issuance or the identity of a person.",
  };
}
