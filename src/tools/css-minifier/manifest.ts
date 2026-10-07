import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const cssMinifierManifest = defineDeveloperWebManifest({
  id: "css-minifier",
  name: "Parser-backed CSS Minifier",
  summary: "Parse and compact CSS locally with exact diagnostics, AST serialization and byte-delta reporting instead of regex rewriting.",
  aliases: ["css minifier", "minify css", "parser css compact"],
  jobs: ["minify CSS safely", "measure CSS byte savings"],
  inputTypes: ["css", "text"],
  oracleEntryId: "cand-238",
  fixtureFamilies: ["developer-minifiers"],
});

export default cssMinifierManifest;
