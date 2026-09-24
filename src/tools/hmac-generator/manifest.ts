import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const hmacGeneratorManifest = defineDeveloperWebManifest({ id: "hmac-generator", name: "HMAC Generator", summary: "Generate an HMAC-SHA-2 authentication tag locally with an explicit key and message boundary.", aliases: ["hmac sha256", "hmac generator", "message authentication code"], jobs: ["generate HMAC", "sign a message with HMAC"], inputTypes: ["text", "secret"], oracleEntryId: "cand-051", fixtureFamilies: ["hmac-rfc2104"] });
export default hmacGeneratorManifest;
