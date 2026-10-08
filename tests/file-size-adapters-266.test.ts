import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeFileSize } from '../src/engines/file-privacy';
const file = (path: string, name: string) => new File([readFileSync(new URL(path, import.meta.url))], name);
describe('STR-266 diagnostic read-only size adapters', () => {
  it.each(['docx', 'pptx', 'xlsx'])('measures actual %s OOXML ZIP groups without changing input', async (kind) => {
    const source = file(`../tests/ooxml-media-fixtures/embedded.${kind}`, `embedded.${kind}`);
    const before = new Uint8Array(await source.arrayBuffer());
    const answer = await analyzeFileSize({ files: [source] });
    expect(answer).toMatchObject({ kind: 'office', estimatedSavingsBytes: null, sourceMutation: 'none', nextActions: ['ooxml-media-compression'], office: { format: kind } });
    const report = answer.office as { groups: Record<string, { compressedMemberBytes: number }>; compressedMemberBytes: number; zipOverheadBytes: number };
    expect(Object.values(report.groups).reduce((n, group) => n + group.compressedMemberBytes, 0)).toBe(report.compressedMemberBytes);
    expect(report.compressedMemberBytes + report.zipOverheadBytes).toBe(source.size);
    expect(report.groups.media?.compressedMemberBytes).toBeGreaterThan(0);
    expect(new Uint8Array(await source.arrayBuffer())).toEqual(before);
  });
  it('rejects a mismatched OOXML kind instead of trusting its filename', async () => {
    const renamed = file('../tests/ooxml-media-fixtures/embedded.pptx', 'false.docx');
    await expect(analyzeFileSize({ files: [renamed] })).rejects.toMatchObject({ code: 'UNSUPPORTED_INPUT' });
  });
  it('reads MP4 track facts without guessing per-stream bitrate or video FPS', async () => {
    const source = file('../quality/fixtures/video-inspection/video-plus-audio.mp4', 'a.mp4');
    const result = await analyzeFileSize({ files: [source] });
    expect(result).toMatchObject({ kind: 'video', estimatedSavingsBytes: null, recommendedOptimizer: null, video: { videoTracks: 1, audioTracks: 1, durationSeconds: 1.2 } });
    const tracks = (result.video as { tracks: Array<{ fps: unknown; streamBitrateBps: unknown }> }).tracks;
    expect(tracks.every((track) => track.fps === null && track.streamBitrateBps === null)).toBe(true);
  });
  it('keeps fragmented MP4 total duration and average bitrate unknown', async () => {
    const source = file('../quality/fixtures/video-inspection/extension/video-fragmented.mp4', 'frag.mp4');
    const result = await analyzeFileSize({ files: [source] });
    expect(result).toMatchObject({ kind: 'video', estimatedSavingsBytes: null, video: { fragmented: true, durationSeconds: null, averageContainerBitrateBps: null } });
  });
});

describe('STR-266 strict PCM WAVE facts', () => {
  function wav(): Uint8Array {
    const data = new Uint8Array(44 + 8000);
    const view = new DataView(data.buffer);
    const fcc = (pos: number, value: string) => [...value].forEach((char, index) => view.setUint8(pos + index, char.charCodeAt(0)));
    fcc(0, 'RIFF'); view.setUint32(4, data.length - 8, true); fcc(8, 'WAVE');
    fcc(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); fcc(36, 'data'); view.setUint32(40, 8000, true);
    return data;
  }
  it('measures duration and bitrate from actual validated PCM bytes without mutation', async () => {
    const source = new File([Uint8Array.from(wav())], 'audio.wav', { type: 'audio/wav' });
    const before = new Uint8Array(await source.arrayBuffer());
    const result = await analyzeFileSize({ files: [source] });
    expect(result).toMatchObject({ kind: 'audio', estimatedSavingsBytes: null, nextActions: [], recommendedOptimizer: null,
      audio: { codec: 'PCM', durationSeconds: 0.5, sampleRateHz: 8000, channels: 1, bitsPerSample: 16, declaredBitrateBps: 128000, dataBytes: 8000 } });
    expect(new Uint8Array(await source.arrayBuffer())).toEqual(before);
  });
  it('refuses inaccurate PCM format and ambiguous RIFF size with unknown facts', async () => {
    const corruptRate = wav();
    new DataView(corruptRate.buffer).setUint32(28, 12345, true);
    const rate = await analyzeFileSize({ files: [new File([Uint8Array.from(corruptRate)], 'rate.wav')] });
    expect(rate).toMatchObject({ kind: 'audio', audio: { codec: null, durationSeconds: null } });
    const corruptHeader = wav();
    new DataView(corruptHeader.buffer).setUint32(4, 44, true);
    const header = await analyzeFileSize({ files: [new File([Uint8Array.from(corruptHeader)], 'bad.wav')] });
    expect(header).toMatchObject({ kind: 'audio', audio: { codec: null, durationSeconds: null } });
    const fakeMp3 = await analyzeFileSize({ files: [new File(['not mp3'], 'audio.mp3', { type: 'audio/mpeg' })] });
    expect(fakeMp3).toMatchObject({ kind: 'unknown', estimatedSavingsBytes: null });
  });
});
