import type { ToolManifest } from "../../catalog/manifest";

export const vcfViewerCsvExportManifest = {
  id: "vcf-viewer-csv-export",
  route: "/tools/vcf-viewer-csv-export",
  name: "VCF / vCard Viewer & CSV Export",
  summary: "Inspect vCard contacts locally, preserve folded and repeated fields, keep unsupported properties visible and export injection-safe CSV.",
  aliases: ["vcard viewer", "vcf to csv", "contact file viewer"],
  jobs: ["inspect VCF contacts", "export vCard contacts to CSV", "view unsupported vCard properties"],
  category: "data",
  inputTypes: ["file", "text"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/vcf-viewer-csv-export/module.ts",
  engine: "developer-web",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: {
    accepts: [{ type: "file", format: "vcf", maxBytes: 1_048_576 }],
    emits: [{ type: "table", format: "csv", maxBytes: 2_097_152, requiresUniqueHeaders: true, acceptsRaggedRows: false }],
  },
  result: { class: "table", capabilities: ["download", "retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-226", fixtureFamilies: ["vcard-rfc6350"] },
  page: { component: "VcfViewerCsvExportTool", clientDirective: "load" },
} as const satisfies ToolManifest & { readonly page: { readonly component: string; readonly clientDirective: "load" } };

export default vcfViewerCsvExportManifest;
