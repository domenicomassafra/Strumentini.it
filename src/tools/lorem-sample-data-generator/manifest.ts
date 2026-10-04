import type { ToolManifest } from "../../catalog/manifest";

export const loremSampleDataGeneratorManifest = {
  id: "lorem-sample-data-generator",
  route: "/tools/lorem-sample-data-generator",
  name: "Lorem & Sample-Data Generator",
  summary: "Generate deterministic local sample words, sentences, paragraphs, names, emails, numbers, or rows.",
  aliases: ["lorem ipsum generator", "sample data generator", "fake csv data"],
  jobs: ["generate sample data", "create lorem ipsum", "make test records"],
  category: "text",
  inputTypes: ["text", "list", "csv"],
  implementation: "../tools/lorem-sample-data-generator/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-019", fixtureFamilies: ["word-character-line-count", "text-writing-local-jobs"] },
} as const satisfies ToolManifest;

export default loremSampleDataGeneratorManifest;
