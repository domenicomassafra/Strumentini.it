import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const httpStatusReferenceManifest = defineDeveloperWebManifest({ id: "http-status-reference", name: "HTTP Status Reference", summary: "Look up common HTTP status classes and descriptions from a local RFC 9110-aligned reference set.", aliases: ["http status codes", "status code lookup", "http response reference"], jobs: ["look up HTTP status", "explain status class"], inputTypes: ["number", "text"], oracleEntryId: "cand-056", fixtureFamilies: ["http-status"] });
export default httpStatusReferenceManifest;
