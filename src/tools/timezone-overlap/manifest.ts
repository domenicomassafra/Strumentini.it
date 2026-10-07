import type { ToolManifest } from "../../catalog/manifest";

export const timezoneOverlapManifest = {
  id: "timezone-overlap",
  route: "/tools/timezone-overlap",
  name: "Timezone Overlap",
  summary: "Find shared working hours across two IANA timezones with DST-aware local-time rules.",
  aliases: ["time zone overlap", "working hours overlap", "client timezone overlap"],
  jobs: ["compare working hours", "find meeting overlap", "schedule across timezones"],
  category: "date-time",
  inputTypes: ["date", "time", "timezone"],
  implementation: "../tools/timezone-overlap/module.ts",
  engine: "client-time-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [
    { key: "timezone" },
    { key: "workingHours", defaultValue: { start: "09:00", end: "17:00" } },
  ],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-086",
    fixtureFamilies: ["timezone-dst"],
  },
} as const satisfies ToolManifest;

export default timezoneOverlapManifest;
