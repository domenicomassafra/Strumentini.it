import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonTypeSchemaInferenceManifest = defineDeveloperWebManifest({
  id: "json-type-schema-inference",
  name: "JSON to TypeScript & JSON Schema",
  summary: "Infer reproducible TypeScript and JSON Schema shapes from one JSON example with explicit limits and safe handling of hostile property names.",
  aliases: ["json to typescript", "json schema inference", "infer types from json"],
  jobs: ["infer TypeScript from JSON", "infer JSON Schema", "inspect heterogeneous JSON arrays"],
  inputTypes: ["json", "text"],
  oracleEntryId: "cand-212",
  fixtureFamilies: ["json-grammar", "developer-structured-data"],
});
export default jsonTypeSchemaInferenceManifest;
