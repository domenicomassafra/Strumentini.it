export const VIES_AUTHORITY = "European Commission — VIES VAT Information Exchange System";
export const VIES_SOURCE = "https://ec.europa.eu/taxation_customs/vies/";
export const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ViesCheckResult =
  | {
      readonly state: "remote-valid" | "remote-invalid";
      readonly valid: boolean;
      readonly countryCode: "IT";
      readonly vatNumber: string;
      readonly requestDate: string | null;
      readonly authority: typeof VIES_AUTHORITY;
      readonly source: typeof VIES_SOURCE;
      readonly retrievedAt: string;
    }
  | {
      readonly state: "unavailable";
      readonly valid: null;
      readonly countryCode: "IT";
      readonly vatNumber: string;
      readonly authority: typeof VIES_AUTHORITY;
      readonly source: typeof VIES_SOURCE;
      readonly retrievedAt: string;
      readonly reason: string;
    };

function xmlEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function xmlValue(xml: string, tag: string): string | null {
  const match = new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`, "iu").exec(xml);
  return match?.[1]?.trim() ?? null;
}

function faultReason(xml: string): string | null {
  return xmlValue(xml, "faultstring") ?? xmlValue(xml, "faultcode");
}

function unavailable(vatNumber: string, retrievedAt: string, reason: string): ViesCheckResult {
  return {
    state: "unavailable",
    valid: null,
    countryCode: "IT",
    vatNumber,
    authority: VIES_AUTHORITY,
    source: VIES_SOURCE,
    retrievedAt,
    reason,
  };
}

export async function checkViesVat(
  vatNumber: string,
  options: { readonly fetchImpl?: FetchLike; readonly now?: () => Date } = {},
): Promise<ViesCheckResult> {
  if (!/^\d{11}$/u.test(vatNumber)) throw new TypeError("VIES_IT_VAT_INVALID");
  const fetchImpl = options.fetchImpl ?? fetch;
  const retrievedAt = (options.now ?? (() => new Date()))().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vies="urn:ec.europa.eu:taxud:vies:services:checkVat:types"><soap:Body><vies:checkVat><vies:countryCode>IT</vies:countryCode><vies:vatNumber>${xmlEscape(vatNumber)}</vies:vatNumber></vies:checkVat></soap:Body></soap:Envelope>`;

  let response: Response;
  try {
    response = await fetchImpl(VIES_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "text/xml; charset=utf-8",
        soapaction: '""',
        accept: "text/xml, application/soap+xml",
      },
      body,
    });
  } catch {
    return unavailable(vatNumber, retrievedAt, "VIES_NETWORK_UNAVAILABLE");
  }

  let xml: string;
  try {
    xml = await response.text();
  } catch {
    return unavailable(vatNumber, retrievedAt, "VIES_RESPONSE_UNREADABLE");
  }
  const fault = faultReason(xml);
  if (!response.ok || fault !== null) return unavailable(vatNumber, retrievedAt, fault ?? `VIES_HTTP_${String(response.status)}`);

  const validText = xmlValue(xml, "valid");
  if (validText !== "true" && validText !== "false") return unavailable(vatNumber, retrievedAt, "VIES_RESPONSE_INVALID");
  const valid = validText === "true";
  return {
    state: valid ? "remote-valid" : "remote-invalid",
    valid,
    countryCode: "IT",
    vatNumber,
    requestDate: xmlValue(xml, "requestDate"),
    authority: VIES_AUTHORITY,
    source: VIES_SOURCE,
    retrievedAt,
  };
}
