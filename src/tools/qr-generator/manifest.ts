import type { ToolManifest } from "../../catalog/manifest";

export const qrGeneratorManifest = {
  id: "qr-generator",
  route: "/tools/qr-generator",
  name: "QR Generator",
  summary: "Generate a standards-shaped QR matrix and SVG locally from UTF-8 text, URLs or a privacy-local Wi-Fi preset.",
  aliases: ["make qr code", "qr svg generator", "wifi qr code"],
  jobs: ["create a qr code from text", "generate a shareable qr matrix", "create a Wi-Fi QR code"],
  category: "marketing",
  inputTypes: ["text", "url", "wifi-credentials"],
  implementation: "../tools/qr-generator/module.ts",
  engine: "qr-local",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "image", capabilities: ["download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-066", fixtureFamilies: ["qr-contract"] },
} as const satisfies ToolManifest;

export default qrGeneratorManifest;
