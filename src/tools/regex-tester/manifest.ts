import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const regexTesterManifest = defineDeveloperWebManifest({ id: "regex-tester", name: "Regex Tester", summary: "Compile a bounded ECMAScript regular expression and inspect deterministic match groups locally.", aliases: ["regular expression tester", "regex debugger", "pattern matcher"], jobs: ["test regular expression", "inspect regex matches", "preview regex replacement"], inputTypes: ["text", "regex"], capabilities: ["worker"], oracleEntryId: "cand-052", fixtureFamilies: ["json-grammar"] });
export default regexTesterManifest;
