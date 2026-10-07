import type { ToolManifest } from "../../catalog/manifest";

export const browserTextToSpeechManifest = {
  id: "browser-text-to-speech",
  route: "/tools/browser-text-to-speech",
  name: "Browser Text-to-Speech",
  summary: "Speak text with runtime SpeechSynthesis voices, Italian filtering, rate/pitch controls and recoverable stop/restart behavior.",
  aliases: ["text to speech", "TTS italiano", "leggi testo", "voce browser"],
  jobs: ["read text aloud", "use Italian browser voice", "test speech rate and pitch"],
  category: "media",
  inputTypes: ["text", "speech-settings"],
  implementation: "../tools/browser-text-to-speech/module.ts",
  engine: "browser-audio",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "locale" }],
  result: { class: "text-code", capabilities: ["reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-248", fixtureFamilies: ["browser-audio-utilities"] },
} as const satisfies ToolManifest;

export default browserTextToSpeechManifest;
