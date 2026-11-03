export const VIES_AUTHORITY = "European Commission — VIES VAT Information Exchange System";
export const VIES_SOURCE = "https://ec.europa.eu/taxation_customs/vies/";
export const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// VIES is an external SOAP service: the Worker request must own a deadline and a
// response ceiling instead of trusting the remote peer to finish in time or small.
const VIES_TIMEOUT_MS = 10_000;
const VIES_RESPONSE_MAX_BYTES = 64 * 1024;

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

async function readCappedText(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || value === undefined) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function checkViesVat(
  vatNumber: string,
  options: { readonly fetchImpl?: FetchLike; readonly now?: () => Date; readonly timeoutMs?: number } = {},
): Promise<ViesCheckResult> {
  if (!/^\d{11}$/u.test(vatNumber)) throw new TypeError("VIES_IT_VAT_INVALID");
  const fetchImpl = options.fetchImpl ?? fetch;
  const retrievedAt = (options.now ?? (() => new Date()))().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vies="urn:ec.europa.eu:taxud:vies:services:checkVat:types"><soap:Body><vies:checkVat><vies:countryCode>IT</vies:countryCode><vies:vatNumber>${xmlEscape(vatNumber)}</vies:vatNumber></vies:checkVat></soap:Body></soap:Envelope>`;

  const signal = AbortSignal.timeout(options.timeoutMs ?? VIES_TIMEOUT_MS);
  const timedOut = (): boolean => signal.aborted;

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
      signal,
    });
  } catch {
    return unavailable(vatNumber, retrievedAt, timedOut() ? "VIES_TIMEOUT" : "VIES_NETWORK_UNAVAILABLE");
  }

  let xml: string | null;
  try {
    xml = await readCappedText(response, VIES_RESPONSE_MAX_BYTES);
  } catch {
    return unavailable(vatNumber, retrievedAt, timedOut() ? "VIES_TIMEOUT" : "VIES_RESPONSE_UNREADABLE");
  }
  if (xml === null) return unavailable(vatNumber, retrievedAt, "VIES_RESPONSE_TOO_LARGE");
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
