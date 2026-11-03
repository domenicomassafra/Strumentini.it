import { describe, expect, it, vi } from "vitest";
import { checkViesVat, VIES_ENDPOINT } from "../worker/vies";

const validSoap = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><checkVatResponse xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types"><countryCode>IT</countryCode><vatNumber>12345678903</vatNumber><requestDate>2026-10-06</requestDate><valid>true</valid><name>---</name><address>---</address></checkVatResponse></soap:Body></soap:Envelope>`;

describe("opt-in VIES adapter", () => {
  it("posts only the validated Italian VAT number to the official VIES SOAP endpoint", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(validSoap, { status: 200, headers: { "content-type": "text/xml" } }));
    const result = await checkViesVat("12345678903", { fetchImpl, now: () => new Date("2026-10-06T12:00:00Z") });
    expect(result).toMatchObject({ state: "remote-valid", valid: true, countryCode: "IT", vatNumber: "12345678903", requestDate: "2026-10-06", retrievedAt: "2026-10-06T12:00:00.000Z" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(VIES_ENDPOINT);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("<vies:vatNumber>12345678903</vies:vatNumber>");
  });

  it("keeps authoritative invalid distinct from transport/service unavailability", async () => {
    const invalidXml = validSoap.replace("<valid>true</valid>", "<valid>false</valid>");
    expect(await checkViesVat("12345678903", { fetchImpl: async () => new Response(invalidXml, { status: 200 }) })).toMatchObject({ state: "remote-invalid", valid: false });
    expect(await checkViesVat("12345678903", { fetchImpl: async () => { throw new Error("offline"); } })).toMatchObject({ state: "unavailable", valid: null, reason: "VIES_NETWORK_UNAVAILABLE" });
    const fault = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>MS_UNAVAILABLE</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
    expect(await checkViesVat("12345678903", { fetchImpl: async () => new Response(fault, { status: 500 }) })).toMatchObject({ state: "unavailable", valid: null, reason: "MS_UNAVAILABLE" });
  });

  it.each([
    ["HTML with a valid tag", "<html><valid>true</valid></html>"],
    ["SOAP for another country", validSoap.replace("<countryCode>IT</countryCode>", "<countryCode>DE</countryCode>")],
    ["SOAP for another VAT", validSoap.replace("<vatNumber>12345678903</vatNumber>", "<vatNumber>99999999999</vatNumber>")],
    ["SOAP with a foreign response namespace", validSoap.replace("urn:ec.europa.eu:taxud:vies:services:checkVat:types", "urn:unrelated")],
    ["SOAP with conflicting valid values", validSoap.replace("<valid>true</valid>", "<valid>true</valid><valid>false</valid>")],
    ["SOAP with a malformed closing tag", validSoap.replace("</checkVatResponse>", "</wrongResponse>")],
  ])("never certifies %s", async (_case, body) => {
    const result = await checkViesVat("12345678903", { fetchImpl: async () => new Response(body, { status: 200 }) });
    expect(result).toMatchObject({ state: "unavailable", valid: null, reason: "VIES_RESPONSE_INVALID" });
  });

  it("accepts a namespace-qualified VIES response with matching echo fields", async () => {
    const prefixed = validSoap
      .replace('<checkVatResponse xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">', '<v:checkVatResponse xmlns:v="urn:ec.europa.eu:taxud:vies:services:checkVat:types" xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">')
      .replace("</checkVatResponse>", "</v:checkVatResponse>")
      .replace("<valid>true</valid>", "<valid>false</valid>");
    expect(await checkViesVat("12345678903", { fetchImpl: async () => new Response(prefixed, { status: 200 }) })).toMatchObject({ state: "remote-invalid", valid: false });
  });

  it("refuses malformed input before any network request", async () => {
    const fetchImpl = vi.fn();
    await expect(checkViesVat("123", { fetchImpl })).rejects.toThrow("VIES_IT_VAT_INVALID");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("VIES remote transport bounds (#556)", () => {
  it("gives the outbound SOAP request its own abort deadline", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(validSoap, { status: 200 }));
    await checkViesVat("12345678903", { fetchImpl });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports an explicit unavailable reason when the remote call exceeds its deadline", async () => {
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!(signal instanceof AbortSignal)) return reject(new Error("missing abort signal"));
      signal.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")));
    });
    const started = Date.now();
    const result = await checkViesVat("12345678903", { fetchImpl, timeoutMs: 25 });
    expect(result).toMatchObject({ state: "unavailable", valid: null, reason: "VIES_TIMEOUT" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("refuses an oversized streamed response before parsing it", async () => {
    const chunk = new TextEncoder().encode("<checkVatResponse>".repeat(200));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < 100; index += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const result = await checkViesVat("12345678903", { fetchImpl: async () => new Response(stream, { status: 200 }) });
    expect(result).toMatchObject({ state: "unavailable", valid: null, reason: "VIES_RESPONSE_TOO_LARGE" });
  });

  it("refuses a declared oversized response without reading the body", async () => {
    const result = await checkViesVat("12345678903", {
      fetchImpl: async () => new Response(validSoap, { status: 200, headers: { "content-length": "5000000" } }),
    });
    expect(result).toMatchObject({ state: "unavailable", valid: null, reason: "VIES_RESPONSE_TOO_LARGE" });
  });
});
