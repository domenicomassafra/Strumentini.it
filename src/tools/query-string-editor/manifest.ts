import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const queryStringEditorManifest = defineDeveloperWebManifest({ id: "query-string-editor", name: "Query-String Editor", summary: "Parse, edit, remove, sort, and re-serialize URL query pairs with repeated-key order preserved.", aliases: ["query string editor", "URL parameter editor", "search params editor"], jobs: ["edit query string", "remove URL parameters", "sort query parameters"], inputTypes: ["url", "text"], oracleEntryId: "cand-059", fixtureFamilies: ["query-params"] });
export default queryStringEditorManifest;
