import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const hashGeneratorManifest = defineDeveloperWebManifest({ id: "hash-generator", name: "Hash Generator", summary: "Generate SHA-256, SHA-384, or SHA-512 digests for UTF-8 text using local Web Crypto.", aliases: ["sha256 generator", "sha512 hash", "text hasher"], jobs: ["hash text", "generate SHA-256", "generate SHA-512"], inputTypes: ["text"], oracleEntryId: "cand-050", fixtureFamilies: ["sha2-known-answers"] });
export default hashGeneratorManifest;
