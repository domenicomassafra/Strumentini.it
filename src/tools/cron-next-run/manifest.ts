import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const cronNextRunManifest = defineDeveloperWebManifest({ id: "cron-next-run", name: "Cron Next-Run Calculator", summary: "Calculate the next UTC matches for a bounded POSIX five-field cron expression.", aliases: ["cron next run", "next cron occurrence", "cron schedule calculator"], jobs: ["calculate next cron run", "preview cron occurrences"], inputTypes: ["text", "date-time", "cron"], oracleEntryId: "cand-054", fixtureFamilies: ["date-arithmetic"] });
export default cronNextRunManifest;
