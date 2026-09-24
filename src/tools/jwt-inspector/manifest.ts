import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jwtInspectorManifest = defineDeveloperWebManifest({ id: "jwt-inspector", name: "JWT Inspector", summary: "Inspect JWT compact parts, claims, timestamps, and unsecured-token warnings without verifying trust.", aliases: ["jwt decoder", "jwt debugger", "json web token inspector"], jobs: ["inspect JWT claims", "decode JWT header", "check unsecured JWT"], inputTypes: ["jwt", "text"], oracleEntryId: "cand-048", fixtureFamilies: ["jwt-structure"] });
export default jwtInspectorManifest;
