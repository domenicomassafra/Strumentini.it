import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const userAgentParserManifest = defineDeveloperWebManifest({ id: "user-agent-parser", name: "User-Agent Parser", summary: "Parse descriptive browser, operating-system, device, and engine hints without using them for capability decisions.", aliases: ["user agent parser", "UA string reader", "browser user-agent decoder"], jobs: ["parse user-agent string", "inspect browser hints", "identify device hints"], inputTypes: ["text"], oracleEntryId: "cand-058", fixtureFamilies: ["http-status"] });
export default userAgentParserManifest;
