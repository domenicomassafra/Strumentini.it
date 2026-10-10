import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const xmlFormatterValidatorManifest = defineDeveloperWebManifest({
  id: "xml-formatter-validator",
  name: "XML Validator, Formatter & Minifier",
  summary: "Format and validate XML; optimize supported static SVG locally using SVGO (MIT). Active, remote and complex markup is refused.",
  aliases: ["xml formatter", "xml validator", "xml minifier", "svg static optimizer"],
  jobs: ["validate XML", "format XML", "minify XML safely", "optimize supported static vector SVG locally"],
  inputTypes: ["xml", "text", "svg"],
  oracleEntryId: "cand-213",
  fixtureFamilies: ["developer-structured-data"],
});
export default xmlFormatterValidatorManifest;
