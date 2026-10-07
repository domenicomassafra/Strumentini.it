import type { ToolManifest } from "../../catalog/manifest";
import { textResultV2Declaration } from "../text-writing/result-v2";

export const subtitleSrtVttTransformManifest = {
  id: "subtitle-srt-vtt-transform",
  route: "/tools/subtitle-srt-vtt-transform",
  name: "SRT / VTT Subtitle Transform & Transcript",
  summary: "Convert SRT and WebVTT locally, offset or rescale cue timings, export a clean transcript and inspect configurable reading-speed/overlap diagnostics.",
  aliases: ["srt vtt converter", "subtitle offset", "subtitle transcript", "subtitle readability", "converti sottotitoli"],
  jobs: ["convert SRT to VTT", "convert VTT to SRT", "offset subtitle timings", "rescale subtitle timings", "export subtitle transcript", "check subtitle reading speed"],
  category: "media",
  inputTypes: ["text"],
  capabilities: ["clipboard"],
  implementation: "../tools/subtitle-srt-vtt-transform/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: {
    accepts: [{ type: "text", format: "srt-or-webvtt", maxBytes: 2097152 }],
    emits: [{ type: "file", format: "srt-vtt-or-text", maxBytes: 8388608 }],
  },
  result: textResultV2Declaration("subtitle-srt-vtt-transform"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-249", fixtureFamilies: ["subtitle-transform"] },
} as const satisfies ToolManifest;

export default subtitleSrtVttTransformManifest;
