import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const xmlFormatterValidatorManifest = defineDeveloperWebManifest({
  id: "xml-formatter-validator",
  name: "XML Validator, Formatter & Minifier",
  summary: "Validate, prettify or conservatively minify XML locally while refusing DTD/entity resolution and preserving sensitive whitespace.",
  aliases: ["xml formatter", "xml validator", "xml minifier"],
  jobs: ["validate XML", "format XML", "minify XML safely"],
  inputTypes: ["xml", "text"],
  oracleEntryId: "cand-213",
  fixtureFamilies: ["developer-structured-data"],
});
export default xmlFormatterValidatorManifest;
