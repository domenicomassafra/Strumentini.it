import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const htmlEntityCodecManifest = defineDeveloperWebManifest({ id: "html-entity-codec", name: "HTML Entity Encode & Decode", summary: "Convert HTML character entities as text while clearly separating decoding from sanitization.", aliases: ["html entity encoder", "html entity decoder", "character entity converter"], jobs: ["encode HTML entities", "decode HTML entities"], inputTypes: ["text", "html"], oracleEntryId: "cand-046", fixtureFamilies: ["html-entities"] });
export default htmlEntityCodecManifest;
