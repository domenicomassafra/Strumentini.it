import type { ToolManifest } from "../../catalog/manifest";

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
  gold: { maintenanceClass: "D", oracleEntryId: "cand-014", fixtureFamilies: ["markdown-xss"] },
} as const satisfies ToolManifest;

export default markdownPreviewManifest;
