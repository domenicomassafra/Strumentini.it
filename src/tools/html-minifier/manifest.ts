import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const htmlMinifierManifest = defineDeveloperWebManifest({
  id: "html-minifier",
  name: "Semantic HTML Minifier",
  summary: "Parse and compact HTML locally while preserving meaningful inline and sensitive-element whitespace with safe and advanced modes.",
  aliases: ["html minifier", "semantic html minify", "safe html compact"],
  jobs: ["minify HTML without breaking text whitespace", "compact HTML with parser semantics"],
  inputTypes: ["html", "text"],
  oracleEntryId: "cand-239",
  fixtureFamilies: ["developer-minifiers"],
});

export default htmlMinifierManifest;
