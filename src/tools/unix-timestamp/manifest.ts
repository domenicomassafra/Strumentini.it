import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const unixTimestampManifest = defineDeveloperWebManifest({ id: "unix-timestamp", name: "Unix Timestamp Converter", summary: "Convert between Unix seconds or milliseconds and an explicit UTC date-time string.", aliases: ["epoch converter", "unix time converter", "timestamp decoder"], jobs: ["convert Unix timestamp", "convert date to epoch", "decode epoch seconds"], inputTypes: ["number", "date-time"], oracleEntryId: "cand-055", fixtureFamilies: ["date-arithmetic"] });
export default unixTimestampManifest;
