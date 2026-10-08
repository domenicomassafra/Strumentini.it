import type { ToolManifest } from "../../catalog/manifest";

export const videoInspectorManifest = {
  id: "video-inspector",
  route: "/tools/video-inspector",
  name: "Local MP4 Inspector and Target Size",
  summary: "Inspect bounded MP4 container metadata and calculate theoretical size-to-bitrate budgets locally without transcoding.",
  aliases: ["video inspector", "MP4 metadata reader", "video target size"],
  jobs: ["inspect MP4 tracks and container duration", "calculate a video target-size bitrate budget"],
  category: "media",
  inputTypes: ["video/mp4", "number"],
  capabilities: ["file-read"],
  implementation: "../tools/video-inspector/module.ts",
  engine: "video",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["reset", "retry", "provenance"] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-260", fixtureFamilies: ["video-inspection-mp4"] },
} as const satisfies ToolManifest;

export default videoInspectorManifest;
