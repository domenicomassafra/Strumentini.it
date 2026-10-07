import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const jwtInspectorManifest = defineDeveloperWebManifest({ id: "jwt-inspector", name: "JWT Inspector", summary: "Inspect JWT compact parts and interpret exp/nbf/iat against a visible reference time without verifying trust.", aliases: ["jwt decoder", "jwt debugger", "json web token inspector", "jwt expiration checker"], jobs: ["inspect JWT claims", "decode JWT header", "check unsecured JWT", "interpret JWT temporal claims"], inputTypes: ["jwt", "text", "date-time"], oracleEntryId: "cand-048", fixtureFamilies: ["jwt-structure"] });
export default jwtInspectorManifest;
