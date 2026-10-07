import type { ToolManifest } from "../../catalog/manifest";

export const audioGeneratorManifest = {
  id: "audio-generator",
  route: "/tools/audio-generator",
  name: "Tone, Metronome & Noise Generator",
  summary: "Generate bounded tones, tap-tempo metronome clicks, and white/pink/brown noise through the browser Web Audio API with explicit stop/background limitations.",
  aliases: ["tone generator", "metronome", "white noise", "pink noise", "brown noise", "tap tempo"],
  jobs: ["play test tone", "run metronome", "measure tap tempo", "play white pink or brown noise"],
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
