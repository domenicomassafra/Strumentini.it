import type { ToolManifest } from "../../catalog/manifest";
import { IMAGE_RESULT_DECLARATIONS } from "../image-result-declarations";

export const imageResizeManifest = {
  id: "image-resize",
  route: "/tools/image-resize",
  name: "Image Resize",
  summary: "Resize or crop JPEG, PNG, and WebP images locally to bounded JPEG or WebP output.",
  aliases: ["photo resize", "image resizer", "resize photo"],
  jobs: ["resize image", "crop image", "convert image to jpeg", "convert image to webp"],
  category: "files-assets",
  inputTypes: ["image/jpeg", "image/png", "image/webp"],
  implementation: "../tools/image-resize/module.ts",
  engine: "image",
  runtime: {
    location: "LOCAL",
    network: "forbidden",
  },
  profileFields: [],
  result: IMAGE_RESULT_DECLARATIONS["image-resize"],
  gold: {
    maintenanceClass: "H",
    oracleEntryId: "cand-141",
    fixtureFamilies: ["image-metadata", "mime-file-signatures"],
  },
} as const satisfies ToolManifest;

export default imageResizeManifest;
