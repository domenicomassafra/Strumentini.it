import { XMLParser, XMLValidator } from "fast-xml-parser";

export const VIES_AUTHORITY = "European Commission — VIES VAT Information Exchange System";
export const VIES_SOURCE = "https://ec.europa.eu/taxation_customs/vies/";
export const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

const SOAP_NAMESPACE = "http://schemas.xmlsoap.org/soap/envelope/";
const VIES_NAMESPACE = "urn:ec.europa.eu:taxud:vies:services:checkVat:types";
const xmlParser = new XMLParser({ ignoreAttributes: false, ignoreDeclaration: true, parseTagValue: false });

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

type XmlNamespaces = Record<string, string>;

function xmlElement(
  parent: unknown,
  localName: string,
  expectedNamespace: string,
  inherited: XmlNamespaces,
): { value: unknown; namespaces: XmlNamespaces } | null {
  if (typeof parent !== "object" || parent === null || Array.isArray(parent)) return null;
  const matches = Object.entries(parent).filter(([tag]) => tag.split(":").at(-1) === localName);
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!match) return null;
  const [tag, value] = match;
  const namespaces = { ...inherited };
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, uri] of Object.entries(value)) {
      if (key === "@_xmlns" && typeof uri === "string") namespaces[""] = uri;
      else if (key.startsWith("@_xmlns:") && typeof uri === "string") namespaces[key.slice(8)] = uri;
    }
  }
  const prefix = tag.includes(":") ? tag.slice(0, tag.indexOf(":")) : "";
  if (namespaces[prefix] !== expectedNamespace) return null;
  return { value, namespaces };
}

function verifiedViesResponse(xml: string, vatNumber: string): { valid: boolean; requestDate: string | null } | null {
  if (XMLValidator.validate(xml) !== true) return null;
  let document: unknown;
  try {
    document = xmlParser.parse(xml);
  } catch {
    return null;
  }
  const envelope = xmlElement(document, "Envelope", SOAP_NAMESPACE, {});
  const body = envelope && xmlElement(envelope.value, "Body", SOAP_NAMESPACE, envelope.namespaces);
  const response = body && xmlElement(body.value, "checkVatResponse", VIES_NAMESPACE, body.namespaces);
  if (!response) return null;
  const country = xmlElement(response.value, "countryCode", VIES_NAMESPACE, response.namespaces)?.value;
  const number = xmlElement(response.value, "vatNumber", VIES_NAMESPACE, response.namespaces)?.value;
  const validity = xmlElement(response.value, "valid", VIES_NAMESPACE, response.namespaces)?.value;
  if (country !== "IT" || number !== vatNumber || (validity !== "true" && validity !== "false")) return null;
  const date = xmlElement(response.value, "requestDate", VIES_NAMESPACE, response.namespaces)?.value;
  return { valid: validity === "true", requestDate: typeof date === "string" ? date : null };
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

  const verified = verifiedViesResponse(xml, vatNumber);
  if (verified === null) return unavailable(vatNumber, retrievedAt, "VIES_RESPONSE_INVALID");
  const valid = verified.valid;
  return {
    state: valid ? "remote-valid" : "remote-invalid",
    valid,
    countryCode: "IT",
    vatNumber,
    requestDate: verified.requestDate,
    authority: VIES_AUTHORITY,
    source: VIES_SOURCE,
    retrievedAt,
  };
}
