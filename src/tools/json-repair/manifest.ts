import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonRepairManifest = defineDeveloperWebManifest({
  id: "json-repair",
  name: "Deterministic JSON Repair",
  summary: "Repair only non-ambiguous JSON syntax locally and return every applied edit with its original input span and reason.",
  aliases: ["json repair", "fix malformed json", "jsonc cleanup"],
  jobs: ["repair JSON deterministically", "remove trailing JSON commas", "convert JSONC comments safely"],
  inputTypes: ["json", "text"],
  oracleEntryId: "cand-210",
  fixtureFamilies: ["json-grammar", "developer-structured-data"],
});
export default jsonRepairManifest;
