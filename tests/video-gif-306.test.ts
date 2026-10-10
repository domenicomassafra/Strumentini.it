import { describe, expect, it } from "vitest";
import { VIDEO_GIF_306_LIMITS, videoGif306Plan } from "../src/engines/video/video-gif-306";

const source = { name: "test.mp4", size: 2018 };
const options = { start: 0.25, end: 1.75, fps: 10 as const, maxWidth: 160, scale: 1 as const };

describe("#306 preflight before decoder/worker allocation", () => {
  it("plans exact bounded 10fps frame count and alternative 5fps/scale", () => {
    expect(videoGif306Plan(source, options, 2)).toEqual({
      start: 0.25, end: 1.75, frames: 15, maxWidth: 160, maxHeight: 256,
    });
    expect(videoGif306Plan(source, { ...options, end: null, fps: 5, scale: 0.5 }, 2)).toEqual({
      start: 0.25, end: 2, frames: 9, maxWidth: 80, maxHeight: 256,
    });
    expect(VIDEO_GIF_306_LIMITS.maxFrames).toBe(30);
  });
  it("refuses oversized, too-long and invalid input without opening a decoder", () => {
    expect(() => videoGif306Plan({ name: "huge.mp4", size: 12 * 1024 * 1024 + 1 }, options)).toThrow("INPUT_LIMIT");
    expect(() => videoGif306Plan({ name: "video.exe", size: 2048 }, options)).toThrow("INPUT_LIMIT");
    expect(() => videoGif306Plan(source, options, 12.01)).toThrow("DURATION_LIMIT");
    expect(() => videoGif306Plan(source, { ...options, end: 3.8 }, 12)).toThrow("TRIM_RANGE");
    expect(() => videoGif306Plan(source, { ...options, start: -1 })).toThrow("SETTINGS");
    expect(() => videoGif306Plan(source, { ...options, fps: 30 as 10 })).toThrow("SETTINGS");
    expect(() => videoGif306Plan(source, { ...options, maxWidth: 512 })).toThrow("SETTINGS");
    expect(() => videoGif306Plan(source, { ...options, scale: 2 as 1 })).toThrow("SETTINGS");
    expect(() => videoGif306Plan(source, { ...options, start: 0, end: 0.05 })).toThrow("TRIM_RANGE");
    expect(() => videoGif306Plan(source, { ...options, start: 4, end: 5 }, 2)).toThrow("TRIM_RANGE");
  });
});
