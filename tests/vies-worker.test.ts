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

  it("refuses malformed input before any network request", async () => {
    const fetchImpl = vi.fn();
    await expect(checkViesVat("123", { fetchImpl })).rejects.toThrow("VIES_IT_VAT_INVALID");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
