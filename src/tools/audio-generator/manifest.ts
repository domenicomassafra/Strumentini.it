import type { ToolManifest } from "../../catalog/manifest";

export const audioGeneratorManifest = {
  id: "audio-generator",
  route: "/tools/audio-generator",
  name: "Audio Generator & WAV Editor",
  summary: "Toni e metronomo; editor WAV locale PCM/Float32→PCM16 con ritaglio, unione, velocità, normalizzazione e silenzi. Non converte MP3/AAC.",
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
