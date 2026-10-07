import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "ai-code-fence-bundle",
  route: "/tools/ai-code-fence-bundle",
  name: "AI Code Fences to Files ZIP",
  summary: "Parse fenced code from pasted AI output into deterministic safe file names, preview the tree, and download a local store-only ZIP.",
  aliases: ["ai response to files", "code fences to zip", "chatgpt code to files", "markdown code blocks zip"],
  jobs: ["turn AI code fences into files", "download code blocks as ZIP", "preview AI-generated file tree"],
  category: "files",
  inputTypes: ["text", "markdown"],
  implementation: "../tools/ai-code-fence-bundle/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "retry", "reset", "provenance", "before-after"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-251", fixtureFamilies: ["ai-code-fence-bundle"] },
} as const satisfies ToolManifest;
