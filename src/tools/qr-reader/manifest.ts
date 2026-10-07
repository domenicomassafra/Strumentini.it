import type { ToolManifest } from "../../catalog/manifest";

export const qrReaderManifest = {
  id: "qr-reader",
  route: "/tools/qr-reader",
  name: "QR Reader",
  summary: "Decode a QR matrix or SVG locally, with native image decoding when the browser exposes it.",
  aliases: ["decode qr code", "read qr matrix"],
  jobs: ["decode a qr matrix", "read a pasted qr svg"],
  category: "marketing",
  inputTypes: ["image", "structured"],
  implementation: "../tools/qr-reader/module.ts",
  engine: "qr-local",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-067", fixtureFamilies: ["qr-contract"] },
} as const satisfies ToolManifest;

export default qrReaderManifest;
