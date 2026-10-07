import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonFormatterManifest = defineDeveloperWebManifest({ id: "json-formatter", name: "JSON Formatter & Validator", summary: "Validate, prettify or minify JSON locally with exact parser diagnostics and byte delta.", aliases: ["json formatter", "json validator", "pretty json", "json minifier"], jobs: ["format JSON", "minify JSON", "validate JSON", "inspect JSON syntax", "compare JSON byte size"], inputTypes: ["json", "text"], oracleEntryId: "cand-041", fixtureFamilies: ["json-grammar"] });
export default jsonFormatterManifest;
