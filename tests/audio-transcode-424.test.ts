import { describe, expect, it } from "vitest";
import {
  availableAudioFormats424, inspectAudioContainer424, measureEncodedAudio424,
  validateAudioTarget424,
} from "../src/engines/browser-audio/transcode-424";

describe("STR-424 audio target bitrate and honest container output", () => {
  it("offers exactly those native recorders which are available (Safari/WebM refusal)", () => {
    const safari = (mime: string) => mime === "audio/mp4";
    expect(availableAudioFormats424(safari).map((item) => item.mime)).toEqual(["audio/mp4"]);
    expect(availableAudioFormats424(() => false)).toEqual([]);
    expect(availableAudioFormats424(undefined)).toEqual([]);
  });

  it("bounds requested bitrate; reports measured rather than promised output bitrate", () => {
    expect(validateAudioTarget424(64)).toBe(64_000);
    expect(validateAudioTarget424(192)).toBe(192_000);
    expect(() => validateAudioTarget424(0)).toThrow("AUDIO_424_BITRATE_UNSUPPORTED");
    expect(() => validateAudioTarget424(48.5)).toThrow("AUDIO_424_BITRATE_UNSUPPORTED");
    expect(measureEncodedAudio424(128_000, 8_000, 2)).toMatchObject({
      actualKbps: 32, savedPercent: 93.75,
    });
    expect(() => measureEncodedAudio424(1, 0, 2)).toThrow("AUDIO_424_EMPTY_OUTPUT");
  });

  it("refuses a forged MIME, arbitrary bytes, and mismatched container without producing a download", () => {
    const webm = new Uint8Array(96);
    webm.set([0x1a, 0x45, 0xdf, 0xa3]);
    webm.set(new TextEncoder().encode("A_OPUS OpusHead"), 16);
    expect(inspectAudioContainer424(webm, "audio/webm;codecs=opus")).toMatchObject({
      container: "WebM", codec: "Opus",
    });
    expect(() => inspectAudioContainer424(webm, "audio/mp4")).toThrow("AUDIO_424_CONTAINER_MISMATCH");
    expect(() => inspectAudioContainer424(new Uint8Array(96), "audio/webm;codecs=opus"))
      .toThrow("AUDIO_424_CONTAINER_MISMATCH");
    expect(() => inspectAudioContainer424(webm, "audio/mpeg")).toThrow("AUDIO_424_FORMAT_UNSUPPORTED");

    const mp4 = new Uint8Array(96);
    mp4.set(new TextEncoder().encode("ftyp"), 4);
    mp4.set(new TextEncoder().encode("mp4a"), 32);
    expect(inspectAudioContainer424(mp4, "audio/mp4")).toMatchObject({ container: "MP4", codec: "AAC" });
    expect(() => inspectAudioContainer424(mp4, "audio/ogg;codecs=opus"))
      .toThrow("AUDIO_424_CONTAINER_MISMATCH");
  });
});
