import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeFileSize, createZip } from "../src/engines/file-privacy";
import { createSimplePdf } from "../src/engines/pdf/writer";

function syntheticPng(width: number, height: number): File {
  const image = new Uint8Array(24);
  image.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  image.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(image.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([image], "oversize.png", { type: "image/png" });
}

describe("#069 cross-format analyzer acceptance", () => {
  it("flags image pixel dimensions as potential web oversize without changing pixels or claiming savings", async () => {
    const file = syntheticPng(5000, 4000);
    const before = new Uint8Array(await file.arrayBuffer());
    const result = await analyzeFileSize({ files: [file] });
    const image = result.image as { pixels: number; oversizeStatus: string; oversizeSignals: string[]; bytesPerPixel: number };
    expect(result).toMatchObject({ kind: "image", estimatedSavingsBytes: null, sourceMutation: "none" });
    expect(image.pixels).toBe(20_000_000);
    expect(image.oversizeStatus).toBe("check-intended-use");
    expect(image.oversizeSignals.length).toBeGreaterThanOrEqual(2);
    expect(image.bytesPerPixel).toBe(file.size / image.pixels);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(before);
  });

  it("keeps simple text/vector PDF separate from uncertain PDF, with a disjoint byte budget", async () => {
    const source = createSimplePdf(["Local text only #069"]);
    const file = new File([Uint8Array.from(source)], "text.pdf");
    const answer = await analyzeFileSize({ files: [file] });
    expect(answer).toMatchObject({ kind: "pdf", sizeProfile: "text-vector-candidate", imageShareOfEncodedStreams: 0 });
    const pdf = answer.pdf as { encodedStreamBytes: number; structuralRemainderBytes: number };
    expect(pdf.encodedStreamBytes + pdf.structuralRemainderBytes).toBe(file.size);
    expect(answer.estimatedSavingsBytes).toBeNull();
  });

  it("measures largest OOXML entries across groups; groups and overhead exactly reconcile bytes", async () => {
    const fixture = readFileSync(new URL("./ooxml-media-fixtures/embedded.pptx", import.meta.url));
    const source = new File([fixture], "slides.pptx");
    const answer = await analyzeFileSize({ files: [source] });
    const office = answer.office as {
      largestEntries: Array<{ compressedBytes: number; group: string; path: string }>;
      groups: Record<string, { compressedMemberBytes: number }>;
      zipOverheadBytes: number;
    };
    expect(office.largestEntries.length).toBeGreaterThan(0);
    expect(office.largestEntries[0]!.compressedBytes).toBeGreaterThanOrEqual(office.largestEntries.at(-1)!.compressedBytes);
    expect(["media", "xml", "font", "other"]).toContain(office.largestEntries[0]!.group);
    expect(Object.values(office.groups).reduce((sum, group) => sum + group.compressedMemberBytes, office.zipOverheadBytes)).toBe(source.size);
    expect(answer.nextActions).toContain("ooxml-media-compression");
  });

  it("accounts for ZIP members by extension and lists the largest without decompressing", async () => {
    const created = await createZip({ files: [
      new File(["abc"], "one.txt"),
      new File(["abcdefghijk"], "two.txt"),
      new File(["xyz123"], "three.csv"),
    ] });
    const source = new File([created.blob as Blob], "archive.zip");
    const result = await analyzeFileSize({ files: [source] });
    const zip = result.zip as {
      groupsByExtension: Array<{ extension: string; entryCount: number; compressedBytes: number; uncompressedBytes: number }>;
      zipOverheadBytes: number;
      totalCompressedEntryBytes: number;
      largestEntries: Array<{ path: string }>;
    };
    expect(zip.groupsByExtension).toEqual(expect.arrayContaining([
      expect.objectContaining({ extension: "txt", entryCount: 2, compressedBytes: 14 }),
      expect.objectContaining({ extension: "csv", entryCount: 1, compressedBytes: 6 }),
    ]));
    expect(zip.groupsByExtension.reduce((total, group) => total + group.compressedBytes, zip.zipOverheadBytes)).toBe(source.size);
    expect(zip.totalCompressedEntryBytes).toBe(20);
    expect(zip.largestEntries[0]!.path).toBe("two.txt");
    expect(result.estimatedSavingsBytes).toBeNull();
  });

  it("reports video/audio facts only where verified, unknown bitrate/FPS remain null", async () => {
    const file = new File([readFileSync(new URL("../quality/fixtures/video-inspection/video-plus-audio.mp4", import.meta.url))], "video.mp4");
    const video = (await analyzeFileSize({ files: [file] })).video as {
      durationSeconds: number; tracks: Array<{ codecFourCc: string; fps: number | null; streamBitrateBps: number | null }>;
    };
    expect(video.durationSeconds).toBe(1.2);
    expect(video.tracks.some((track) => track.codecFourCc === "avc1")).toBe(true);
    expect(video.tracks.every((track) => track.fps === null && track.streamBitrateBps === null)).toBe(true);
  });
});
