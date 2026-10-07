import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const markdownPreviewManifest = {
  id: "markdown-preview",
  route: "/tools/markdown-preview",
  name: "Markdown Preview",
  summary: "Render a safe local subset of Markdown while escaping raw HTML and unsafe links.",
  aliases: ["markdown renderer", "preview markdown", "md preview"],
  jobs: ["preview markdown", "render markdown safely", "check markdown formatting"],
  category: "text",
  inputTypes: ["text", "markdown"],
  implementation: "../tools/markdown-preview/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["markdown-preview"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-014", fixtureFamilies: ["markdown-xss", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default markdownPreviewManifest;
