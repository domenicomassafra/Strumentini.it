import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jsonPathManifest = defineDeveloperWebManifest({ id: "json-path-playground", name: "JSON Path Playground", summary: "Query JSON with a bounded JSONPath subset and inspect every returned path and value.", aliases: ["jsonpath playground", "JSON path query", "JSON selector"], jobs: ["query JSON path", "select nested JSON", "preview JSONPath matches"], inputTypes: ["json", "text"], oracleEntryId: "cand-060", fixtureFamilies: ["json-grammar"] });
export default jsonPathManifest;
