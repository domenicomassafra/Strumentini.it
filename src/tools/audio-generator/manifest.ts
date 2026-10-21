import type { ToolManifest } from "../../catalog/manifest";

export const audioGeneratorManifest = {
  id: "audio-generator",
  route: "/tools/audio-generator",
  name: "Audio Generator & WAV Editor",
  summary: "Toni e metronomo; editor WAV PCM16 e compressione audio locale con bitrate e formato selezionabili secondo il browser (Opus/AAC).",
  aliases: ["tone generator", "metronome", "white noise", "pink noise", "brown noise", "tap tempo", "convert wav to pcm16", "trim wav", "merge wav", "remove silence wav", "compress audio", "convert audio opus aac"],
  jobs: ["play test tone", "run metronome", "measure tap tempo", "play white pink or brown noise", "convert wav pcm to pcm16", "trim and merge wav", "preview silence removal", "compress audio with bitrate and format"],
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
