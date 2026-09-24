import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const tomlFormatterManifest = defineDeveloperWebManifest({ id: "toml-formatter", name: "TOML Formatter & Validator", summary: "Parse and format a safe TOML subset locally with bounded nesting and duplicate-key checks.", aliases: ["toml formatter", "toml validator", "pretty toml"], jobs: ["format TOML", "validate TOML", "inspect TOML keys"], inputTypes: ["toml", "text"], oracleEntryId: "cand-043", fixtureFamilies: ["json-grammar"] });
export default tomlFormatterManifest;
