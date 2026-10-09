import snapshot from "../../reference-data/italy/geography-115.snapshot.json";
import {
  validateCodiceFiscale121,
  type CodiceFiscaleValidation121,
} from "./codice-fiscale-121";

/**
 * #122: deterministic *formal* decoding. No identity, age, administrative
 * assignment or historical birth-place date is established by this result.
 * Exact source version stays attached to each source candidate; missing/ND
 * codes never receive an inferred successor's code.
 */
export type CodiceFiscaleGeoCandidate122 = {
  readonly istatCode: string;
  readonly name: string;
  readonly belfiore: string;
  readonly provenance: "ISTAT_CURRENT_2026_02_21" | "SITUAS_SUPPRESSED_128" | "SITUAS_FOREIGN_469";
  readonly sourceVersion: string;
  readonly checkedAt: string;
  readonly temporalValidity: "SNAPSHOT_DATE_ONLY" | "NOT_VERIFIED";
  readonly changeDate?: string;
  readonly changeType?: string;
  readonly relatedIstatCode?: string | null;
  readonly sourceRow?: number;
};

export type CodiceFiscaleDecoding122 =
  | (Extract<CodiceFiscaleValidation121, { status: "INVALID" }> & { readonly status: "INVALID" })
  | (Omit<Extract<CodiceFiscaleValidation121, { status: "FORMALLY_VALID" }>, "status"> & {
    readonly status: "DECODED_FORMALLY";
    readonly geographyCandidates: readonly CodiceFiscaleGeoCandidate122[];
    readonly geographyDateValidity: "NOT_PROVEN_FOR_BIRTH_DATE" | "UNKNOWN_CODE";
    readonly limitations: readonly string[];
  });

const byBelfiore = new Map<string, CodiceFiscaleGeoCandidate122[]>();
function add(candidate: CodiceFiscaleGeoCandidate122): void {
  const matches = byBelfiore.get(candidate.belfiore) ?? [];
  matches.push(Object.freeze(candidate));
  byBelfiore.set(candidate.belfiore, matches);
}

for (const row of snapshot.current) {
  add({
    istatCode: row.istatCode, name: row.name, belfiore: row.belfiore,
    provenance: "ISTAT_CURRENT_2026_02_21", sourceVersion: snapshot.version,
    checkedAt: snapshot.checkedAt, temporalValidity: "SNAPSHOT_DATE_ONLY",
  });
}
for (const row of snapshot.suppressed) {
  if (row.belfiore === null) continue;
  add({
    istatCode: row.istatCode, name: row.name, belfiore: row.belfiore,
    provenance: "SITUAS_SUPPRESSED_128", sourceVersion: snapshot.version,
    checkedAt: snapshot.checkedAt, temporalValidity: "NOT_VERIFIED",
    changeDate: row.changeDate, changeType: row.changeType,
    relatedIstatCode: row.relatedIstatCode, sourceRow: row.sourceRow,
  });
}
for (const row of snapshot.foreign) {
  if (row.belfiore === null) continue;
  add({
    istatCode: String(row.istatCode), name: row.name, belfiore: row.belfiore,
    provenance: "SITUAS_FOREIGN_469", sourceVersion: snapshot.version,
    checkedAt: snapshot.checkedAt, temporalValidity: "NOT_VERIFIED",
  });
}

/** Omocodia positions are explicit; reverse mapping does not decide which
 * person was allocated which official omocode. Year encodes two digits only.
 */
export function decodeCodiceFiscale122(code: string): CodiceFiscaleDecoding122 {
  const formal = validateCodiceFiscale121(code);
  if (formal.status === "INVALID") return formal;
  const { status: _formalStatus, ...derived } = formal;
  const geographyCandidates = (byBelfiore.get(formal.belfiore) ?? [])
    .map((candidate) => ({ ...candidate }));
  return {
    status: "DECODED_FORMALLY", ...derived,
    geographyCandidates,
    geographyDateValidity: geographyCandidates.length > 0 ? "NOT_PROVEN_FOR_BIRTH_DATE" : "UNKNOWN_CODE",
    limitations: [
      "Il codice fiscale non contiene il secolo: le date dal 1900 al 2099 sono soltanto interpretazioni compatibili, non un'età verificata.",
      "Le sostituzioni omocodiche non rivelano l'identità o l'ordine di assegnazione ufficiale.",
      "I luoghi sono candidati tratti da ISTAT/SITUAS; lo storico #115 non certifica la loro validità alla data di nascita.",
      "La correttezza formale non conferma l'attribuzione da parte dell'Agenzia delle Entrate.",
    ],
  };
}
