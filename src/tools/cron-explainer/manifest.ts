import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const cronExplainerManifest = defineDeveloperWebManifest({ id: "cron-explainer", name: "Cron Explainer", summary: "Explain the five POSIX cron schedule fields, ranges, lists, and day-of-month/day-of-week semantics.", aliases: ["cron parser", "cron expression explainer", "crontab reader"], jobs: ["explain cron expression", "parse cron fields", "understand crontab schedule"], inputTypes: ["text", "cron"], oracleEntryId: "cand-053", fixtureFamilies: ["date-arithmetic"] });
export default cronExplainerManifest;
