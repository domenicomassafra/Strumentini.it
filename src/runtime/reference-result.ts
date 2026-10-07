export const REFERENCE_RESULT_STATES = ["local-valid", "remote-valid", "remote-invalid", "stale", "unavailable"] as const;
export type ReferenceResultState = (typeof REFERENCE_RESULT_STATES)[number];

export interface ReferenceResultProvenance {
  readonly state: ReferenceResultState;
  readonly authority: string;
  readonly checkedAt: string;
  readonly retrievedAt?: string;
  readonly validation: "local-formal" | "remote-authoritative" | "none";
  readonly network: "not-used" | "used" | "denied";
  readonly source?: string;
  readonly message: string;
}

function isoInstant(value: string, label: string): string {
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) throw new TypeError(`${label} must be an ISO-compatible timestamp`);
  return new Date(instant).toISOString();
}

export function createReferenceResultProvenance(input: ReferenceResultProvenance): ReferenceResultProvenance {
  const authority = input.authority.trim();
  const message = input.message.trim();
  if (authority === "") throw new TypeError("Reference authority is required.");
  if (message === "") throw new TypeError("Reference result message is required.");
  const checkedAt = isoInstant(input.checkedAt, "checkedAt");
  const retrievedAt = input.retrievedAt === undefined ? undefined : isoInstant(input.retrievedAt, "retrievedAt");

  if ((input.state === "remote-valid" || input.state === "remote-invalid")) {
    if (input.validation !== "remote-authoritative" || input.network !== "used") {
      throw new Error("Remote validity claims require an authoritative remote validation performed over the network.");
    }
    if (retrievedAt === undefined) throw new Error("Remote validity claims require retrievedAt.");
  }
  if (input.state === "local-valid" && input.validation !== "local-formal") {
    throw new Error("Local validity can claim only local-formal validation.");
  }
  if (input.validation === "local-formal" && input.network === "used" && input.state === "local-valid") {
    throw new Error("A local-formal result cannot be presented as a remote network validation.");
  }
  if (input.network === "denied" && (input.state === "remote-valid" || input.state === "remote-invalid")) {
    throw new Error("Network denial cannot produce a remote validity claim.");
  }

  return {
    ...input,
    authority,
    message,
    checkedAt,
    ...(retrievedAt === undefined ? {} : { retrievedAt }),
  };
}
