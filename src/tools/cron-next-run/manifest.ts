import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const cronNextRunManifest = defineDeveloperWebManifest({ id: "cron-next-run", name: "Cron Next-Run Calculator", summary: "Calculate bounded POSIX cron occurrences in a selected IANA timezone and UTC with explicit DST gap/overlap policy.", aliases: ["cron next run", "next cron occurrence", "cron schedule calculator", "timezone cron"], jobs: ["calculate next cron run", "preview cron occurrences", "preview cron across DST"], inputTypes: ["text", "date-time", "cron", "timezone"], oracleEntryId: "cand-054", fixtureFamilies: ["date-arithmetic"] });
export default cronNextRunManifest;
