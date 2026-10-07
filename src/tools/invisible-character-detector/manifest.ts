import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const invisibleCharacterDetectorManifest = {
  id: "invisible-character-detector",
  route: "/tools/invisible-character-detector",
  name: "Invisible-Character Detector",
  summary: "Locate zero-width, directional, and other Unicode format characters with code points and offsets.",
  aliases: ["hidden character finder", "zero width detector", "invisible text inspector"],
  jobs: ["find invisible characters", "detect zero-width text", "inspect hidden formatting"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/invisible-character-detector/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["invisible-character-detector"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-005", fixtureFamilies: ["invisible-characters", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default invisibleCharacterDetectorManifest;
