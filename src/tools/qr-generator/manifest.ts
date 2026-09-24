import type { ToolManifest } from "../../catalog/manifest";

export const qrGeneratorManifest = {
  id: "qr-generator",
  route: "/tools/qr-generator",
  name: "QR Generator",
  summary: "Generate a standards-shaped QR matrix and SVG locally from UTF-8 text or a URL payload.",
  aliases: ["make qr code", "qr svg generator"],
  jobs: ["create a qr code from text", "generate a shareable qr matrix"],
  category: "marketing",
  inputTypes: ["text", "url"],
  implementation: "../tools/qr-generator/module.ts",
  engine: "qr-local",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-066", fixtureFamilies: ["qr-contract"] },
} as const satisfies ToolManifest;

export default qrGeneratorManifest;
