import type { ToolManifest } from "../../catalog/manifest";

export const microphoneRecorderManifest = {
  id: "microphone-recorder",
  route: "/tools/microphone-recorder",
  name: "Microphone Test & Local Recorder",
  summary: "Test microphone health and level, then record, pause, resume, play and download a strictly local Blob using only the runtime-supported MediaRecorder type.",
  aliases: ["microphone test", "mic test", "voice recorder", "local recorder"],
  jobs: ["test microphone health", "record microphone locally", "download local microphone recording"],
  category: "media",
  inputTypes: ["microphone", "audio-settings"],
  capabilities: ["file-write"],
  implementation: "../tools/microphone-recorder/module.ts",
  engine: "browser-audio",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "reset", "provenance"] },
  deterministic: false,
  gold: { maintenanceClass: "E", oracleEntryId: "cand-252", fixtureFamilies: ["browser-audio-utilities"] },
} as const satisfies ToolManifest;

export default microphoneRecorderManifest;
