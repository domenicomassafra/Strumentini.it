import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const mimeTypeLookupManifest = defineDeveloperWebManifest({ id: "mime-type-lookup", name: "MIME Type Lookup", summary: "Look up common media types by extension or inspect a small signature as evidence rather than a safety verdict.", aliases: ["mime lookup", "file type lookup", "media type reference"], jobs: ["look up MIME type", "inspect file signature"], inputTypes: ["text", "bytes"], oracleEntryId: "cand-057", fixtureFamilies: ["mime-file-signatures"] });
export default mimeTypeLookupManifest;
