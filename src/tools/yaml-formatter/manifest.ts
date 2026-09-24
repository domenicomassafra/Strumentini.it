import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const yamlFormatterManifest = defineDeveloperWebManifest({ id: "yaml-formatter", name: "YAML Formatter & Validator", summary: "Parse a bounded YAML subset and format it with explicit unsupported-feature errors.", aliases: ["yaml formatter", "yaml validator", "pretty yaml"], jobs: ["format YAML", "validate YAML", "inspect YAML structure"], inputTypes: ["yaml", "text"], oracleEntryId: "cand-042", fixtureFamilies: ["yaml-core"] });
export default yamlFormatterManifest;
