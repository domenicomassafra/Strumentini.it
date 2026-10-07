import type { ToolManifest } from "../../catalog/manifest";

export const x509CsrInspectorManifest = {
  id: "x509-csr-inspector",
  route: "/tools/x509-csr-inspector",
  name: "X.509 Certificate & CSR Inspector",
  summary: "Inspect bounded PEM or DER certificates and CSRs locally for names, SANs, validity, key, signature and SHA-256 fingerprint facts.",
  aliases: ["x509 certificate viewer", "csr inspector", "pem certificate decoder"],
  jobs: ["inspect X509 certificate", "inspect certificate signing request", "read certificate SAN and fingerprint"],
  category: "developer",
  inputTypes: ["file", "bytes", "text"],
  capabilities: ["file-read"],
  implementation: "../tools/x509-csr-inspector/module.ts",
  engine: "developer-web",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { accepts: [{ type: "file", format: "pem-der", maxBytes: 262_144 }] },
  result: { class: "validator", capabilities: ["retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-227", fixtureFamilies: ["x509-csr-rfc"] },
  page: { component: "X509CsrInspectorTool", clientDirective: "load" },
} as const satisfies ToolManifest & { readonly page: { readonly component: string; readonly clientDirective: "load" } };

export default x509CsrInspectorManifest;
