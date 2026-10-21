import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectAudioMetadata297, probeAudio297, AUDIO_METADATA_TIMEOUT_MS } from "../src/engines/browser-audio/metadata-297";
import { parseAudioMetadata297, projectAudioMetadata297 } from "../src/engines/browser-audio/metadata-297-parser";

const root = new URL("./fixtures/audio-metadata-297/", import.meta.url);
const cases = [
  ["id3v1.mp3", "MP3", "Titolo v1"],
  ["id3v2-unicode.mp3", "MP3", "Città è café 🎵"],
  ["vorbis-flac.flac", "FLAC", "Brano FLAC"],
  ["vorbis.ogg", "Ogg", "Brano Ogg"],
  ["pcm.wav", "WAV", "Brano WAV"],
] as const;

function file(name: string, asName = name): File {
  return new File([readFileSync(new URL(name, root))], asName, { type: "application/octet-stream" });
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("#297 — source signature and actual media vs independent ffprobe", () => {
  for (const [filename, container, title] of cases) {
    it(`reads real ${filename} tags and audio properties`, async () => {
      const source = file(filename);
      expect(await probeAudio297(source)).toBe(container);
      const parsed = await parseAudioMetadata297(source, container);
      const oracle = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
        "stream=channels,sample_rate,bit_rate:format=duration:format_tags=title,artist,album", "-of", "json",
        fileURLToPath(new URL(filename, root))], { encoding: "utf8" }));
      expect(parsed.tags.title).toBe(title);
      expect(parsed.channels).toBe(oracle.streams[0].channels);
      expect(parsed.sampleRateHz).toBe(Number(oracle.streams[0].sample_rate));
      expect(parsed.durationSeconds).not.toBeNull();
      expect(Math.abs(parsed.durationSeconds! - Number(oracle.format.duration))).toBeLessThan(0.09);
      expect(parsed.codec.length).toBeGreaterThan(1);
      if (filename === "id3v2-unicode.mp3") expect(parsed.tagTypes).toContain("ID3v2.3");
      if (filename.includes("vorbis")) expect(parsed.tagTypes).toContain("vorbis");
    });
  }

  it("uses binary signatures rather than extensions or declared MIME", async () => {
    expect(await probeAudio297(file("id3v2-unicode.mp3", "not-really.wav"))).toBe("MP3");
    await expect(probeAudio297(new File([new Uint8Array(512)], "fake.mp3", { type: "audio/mpeg" })))
      .rejects.toThrow(/UNSUPPORTED/u);
    await expect(probeAudio297(new Blob([new Uint8Array(12)]))).rejects.toThrow(/SIZE_LIMIT/u);
    await expect(probeAudio297(new Blob([new Uint8Array(25 * 1024 * 1024)]))).rejects.toThrow(/SIZE_LIMIT/u);
  });

  it("rejects truncated/oversized ID3, invalid FLAC and corrupt media", async () => {
    const malformed = new Uint8Array(96);
    malformed.set([73, 68, 51, 3, 0, 0, 0, 0, 10, 0]); // claims 1280 bytes in a 96-byte file
    await expect(probeAudio297(new Blob([malformed]))).rejects.toThrow(/HEADER_LIMIT/u);
    malformed.set([0, 16, 0, 0], 6); // 262144-byte ID3 header
    await expect(probeAudio297(new Blob([malformed]))).rejects.toThrow(/HEADER_LIMIT/u);
    const flac = new Uint8Array(64);
    flac.set([102, 76, 97, 67, 0, 0, 0, 1]); // STREAMINFO must be 34 bytes
    await expect(probeAudio297(new Blob([flac]))).rejects.toThrow(/INVALID/u);
    const oversizedFlac = new Uint8Array(64);
    oversizedFlac.set([102, 76, 97, 67, 0, 0, 0, 34], 0);
    oversizedFlac.set([4, 4, 0, 0], 42); // following Vorbis comment claims 262144 bytes
    await expect(probeAudio297(new Blob([oversizedFlac]))).rejects.toThrow(/HEADER_LIMIT/u);
    const broken = new Uint8Array(readFileSync(new URL("vorbis.ogg", root))).slice(0, 128);
    await expect(parseAudioMetadata297(new Blob([broken]), "Ogg")).rejects.toThrow();
  });

  it("allows only bounded, cleaned primitive tags; excludes artwork and raw tags", () => {
    const hugePicture = new Uint8Array(800_000);
    const metadata = {
      format: { codec: "MPEG", sampleRate: 44100, numberOfChannels: 2, duration: Infinity, tagTypes: ["ID3v2.3"] },
      common: { title: "A\u202e" + "è".repeat(400), artist: "\u0000\tBob", picture: [{ data: hugePicture, format: "image/png" }], comment: ["secret"] },
      native: { "ID3v2.3": [{ id: "PRIV", value: "hidden" }] },
    } as unknown as Parameters<typeof projectAudioMetadata297>[0];
    const projected = projectAudioMetadata297(metadata, "MP3");
    expect(projected.tags.title).toHaveLength(160);
    expect(projected.tags.title).not.toContain("\u202e");
    expect(projected.tags.artist).toBe("Bob");
    expect(projected.durationSeconds).toBeNull();
    expect(JSON.stringify(projected)).not.toMatch(/picture|PRIV|comment|secret|image\/png/u);
    expect(() => projectAudioMetadata297({ format: {}, common: {} } as never, "MP3")).toThrow(/UNRECOGNIZED/u);
  });

  it("cancels an in-flight preflight Blob read without waiting for I/O", async () => {
    class StalledReadBlob extends Blob {
      override slice(): Blob { return { arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) } as Blob; }
    }
    const controller = new AbortController();
    const pending = inspectAudioMetadata297(new StalledReadBlob([new Uint8Array(64)]), controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("enforces the five-second deadline during preflight Blob I/O", async () => {
    class StalledReadBlob extends Blob {
      override slice(): Blob { return { arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) } as Blob; }
    }
    vi.useFakeTimers();
    const pending = inspectAudioMetadata297(new StalledReadBlob([new Uint8Array(64)]));
    const assertion = expect(pending).rejects.toThrow(/TIMEOUT/u);
    await vi.advanceTimersByTimeAsync(AUDIO_METADATA_TIMEOUT_MS);
    await assertion;
  });

  it("rejects an already-aborted read before starting a worker", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(inspectAudioMetadata297(file("pcm.wav"), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("terminates an unresponsive worker on cancel and hard timeout", async () => {
    class HungWorker {
      static instances: HungWorker[] = [];
      terminated = false;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { HungWorker.instances.push(this); }
      postMessage() {}
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal("Worker", HungWorker);
    const controller = new AbortController();
    const aborting = inspectAudioMetadata297(file("pcm.wav"), controller.signal);
    await vi.waitFor(() => expect(HungWorker.instances).toHaveLength(1));
    controller.abort();
    await expect(aborting).rejects.toMatchObject({ name: "AbortError" });
    expect(HungWorker.instances[0]!.terminated).toBe(true);

    vi.useFakeTimers();
    const timingOut = inspectAudioMetadata297(file("pcm.wav"));
    const rejected = expect(timingOut).rejects.toThrow(/TIMEOUT/u);
    // Blob.arrayBuffer() resolves asynchronously before the worker is created.
    await vi.advanceTimersByTimeAsync(1);
    expect(HungWorker.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(AUDIO_METADATA_TIMEOUT_MS);
    await rejected;
    expect(HungWorker.instances[1]!.terminated).toBe(true);
  });
});
