import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonYamlConverterManifest = defineDeveloperWebManifest({ id: "json-yaml-converter", name: "JSON ↔ YAML Converter", summary: "Convert between JSON and a bounded, safe YAML subset with a visible direction and value model.", aliases: ["json to yaml", "yaml to json", "structured data converter"], jobs: ["convert JSON to YAML", "convert YAML to JSON"], inputTypes: ["json", "yaml"], oracleEntryId: "cand-044", fixtureFamilies: ["yaml-core", "json-grammar"] });
export default jsonYamlConverterManifest;
