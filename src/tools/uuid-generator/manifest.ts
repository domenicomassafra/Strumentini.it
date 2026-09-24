import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const uuidGeneratorManifest = defineDeveloperWebManifest({ id: "uuid-generator", name: "UUID Generator", summary: "Generate RFC 9562 UUIDv4 or UUIDv7 values with Web Crypto randomness and optional uppercase output.", aliases: ["uuid v4 generator", "uuid v7 generator", "guid generator"], jobs: ["generate UUID", "create UUIDv4", "create UUIDv7"], inputTypes: ["number", "text"], oracleEntryId: "cand-049", fixtureFamilies: ["uuid-rfc9562"] });
export default uuidGeneratorManifest;
