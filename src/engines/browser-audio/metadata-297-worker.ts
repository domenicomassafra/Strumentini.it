import { parseAudioMetadata297, type AudioMetadata297 } from "./metadata-297-parser";

self.onmessage = async (event: MessageEvent<{ file: Blob; container: AudioMetadata297["container"] }>) => {
  try {
    const result = await parseAudioMetadata297(event.data.file, event.data.container);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message.slice(0, 180) : "AUDIO_METADATA_INVALID" });
  }
};
