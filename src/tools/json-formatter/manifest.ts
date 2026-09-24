import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonFormatterManifest = defineDeveloperWebManifest({ id: "json-formatter", name: "JSON Formatter & Validator", summary: "Validate and deterministically format JSON without uploading the document.", aliases: ["json formatter", "json validator", "pretty json"], jobs: ["format JSON", "validate JSON", "inspect JSON syntax"], inputTypes: ["json", "text"], oracleEntryId: "cand-041", fixtureFamilies: ["json-grammar"] });
export default jsonFormatterManifest;
