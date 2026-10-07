import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const pdfCopyTextReflowManifest = {
  id: "pdf-copy-text-reflow",
  route: "/tools/pdf-copy-text-reflow",
  name: "PDF-Copy Text Reflow",
  summary: "Reflow pasted PDF text with explicit line-wrap and hyphen rules, preserving visible hyphens and surfacing ambiguity.",
  aliases: ["pdf copy text reflow", "fix pdf line breaks", "reflow copied pdf text"],
  jobs: ["reflow text copied from a PDF", "repair pasted PDF line wraps conservatively"],
  category: "text",
  inputTypes: ["text", "document"],
  implementation: "../tools/pdf-copy-text-reflow/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["pdf-copy-text-reflow"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-236", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default pdfCopyTextReflowManifest;
