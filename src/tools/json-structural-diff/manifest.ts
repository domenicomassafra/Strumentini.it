import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonStructuralDiffManifest = defineDeveloperWebManifest({
  id: "json-structural-diff",
  name: "Structural JSON Diff",
  summary: "Compare JSON values by stable JSON-Pointer paths and distinguish additions, removals, type changes, value changes and array reordering.",
  aliases: ["json diff", "compare json structure", "json pointer diff"],
  jobs: ["compare JSON structurally", "find JSON type changes", "find JSON array reorder"],
  inputTypes: ["json", "text"],
  oracleEntryId: "cand-211",
  fixtureFamilies: ["json-grammar", "developer-structured-data"],
});
export default jsonStructuralDiffManifest;
