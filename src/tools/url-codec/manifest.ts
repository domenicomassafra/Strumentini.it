import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const urlCodecManifest = defineDeveloperWebManifest({ id: "url-codec", name: "URL Encode & Decode", summary: "Percent-encode or decode text with explicit WHATWG URL component, query, path, or userinfo rules.", aliases: ["url encoder", "url decoder", "percent encoding"], jobs: ["percent encode text", "percent decode text"], inputTypes: ["text", "url"], oracleEntryId: "cand-045", fixtureFamilies: ["url-percent-encoding"] });
export default urlCodecManifest;
