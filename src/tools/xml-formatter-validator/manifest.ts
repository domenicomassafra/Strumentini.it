import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const xmlFormatterValidatorManifest = defineDeveloperWebManifest({
  id: "xml-formatter-validator",
  name: "XML Validator, Formatter & Minifier",
  summary: "Validate, prettify or conservatively minify XML locally; opt in to MIT-licensed SVGO optimization for supported static vector SVG only (active, remote and complex markup is refused).",
  aliases: ["xml formatter", "xml validator", "xml minifier", "svg static optimizer"],
  jobs: ["validate XML", "format XML", "minify XML safely", "optimize supported static vector SVG locally"],
  inputTypes: ["xml", "text", "svg"],
  oracleEntryId: "cand-213",
  fixtureFamilies: ["developer-structured-data"],
});
export default xmlFormatterValidatorManifest;
