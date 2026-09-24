import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const base64CodecManifest = defineDeveloperWebManifest({ id: "base64-codec", name: "Base64 Encode & Decode", summary: "Encode or strictly decode UTF-8 text using RFC 4648 Base64 or Base64url.", aliases: ["base64 encoder", "base64 decoder", "base64url converter"], jobs: ["encode Base64", "decode Base64", "convert Base64url"], inputTypes: ["text", "base64"], oracleEntryId: "cand-047", fixtureFamilies: ["base64-rfc4648"] });
export default base64CodecManifest;
