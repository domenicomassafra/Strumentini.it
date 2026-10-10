import type { ToolManifest } from "../../catalog/manifest";

export const audioGeneratorManifest = {
  id: "audio-generator",
  route: "/tools/audio-generator",
  name: "Audio Generator & WAV Editor",
  summary: "Generate bounded tones/metronome/noise and use a separate local WAV PCM 8/16/24/32-bit or Float32 to PCM16 editor with previewable trim, merge, speed, peak normalization and silence cleanup. No MP3/AAC conversion.",
  aliases: ["tone generator", "metronome", "white noise", "pink noise", "brown noise", "tap tempo", "convert wav to pcm16", "trim wav", "merge wav", "remove silence wav"],
  jobs: ["play test tone", "run metronome", "measure tap tempo", "play white pink or brown noise", "convert wav pcm to pcm16", "trim and merge wav", "preview silence removal"],
  category: "media",
  inputTypes: ["number", "audio-settings"],
  implementation: "../tools/audio-generator/module.ts",
  engine: "browser-audio",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "calculator", capabilities: ["reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-247", fixtureFamilies: ["browser-audio-utilities"] },
} as const satisfies ToolManifest;

export default audioGeneratorManifest;
