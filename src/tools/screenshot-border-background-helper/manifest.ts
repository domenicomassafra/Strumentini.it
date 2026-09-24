import type { ToolManifest } from "../../catalog/manifest";

export const screenshot_border_background_helperManifest = {
  id: "screenshot-border-background-helper",
  route: "/tools/screenshot-border-background-helper",
  name: "Screenshot Border / Background Helper",
  summary: "Add a measured border and background around a local screenshot using a bounded canvas output.",
  aliases: ["screenshot border","image background helper"],
  jobs: ["add border to screenshot","add image background"],
  category: "files-assets",
  inputTypes: ["image/jpeg","image/png","image/webp"],
  implementation: "../tools/screenshot-border-background-helper/module.ts",
  engine: "image",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-158", fixtureFamilies: ["image-metadata", "mime-file-signatures"] },
} as const satisfies ToolManifest;

export default screenshot_border_background_helperManifest;
