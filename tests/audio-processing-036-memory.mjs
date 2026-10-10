/** Bounded local Node memory/CPU diagnostic for #036. RSS snapshots are not peak Worker memory. */
import { performance } from 'node:perf_hooks';
import { strict as assert } from 'node:assert';
import { importPcmWav036 } from '../src/engines/browser-audio/wav-convert-036.ts';

const frames = 48000 * 60;
const channels = 2;
const source = new Uint8Array(44 + frames * channels); // Signed output doubles 8-bit PCM data size.
const view = new DataView(source.buffer);
const put = (at, name) => [...name].forEach((ch, i) => { source[at + i] = ch.charCodeAt(0); });
put(0, 'RIFF'); view.setUint32(4, source.length - 8, true);
put(8, 'WAVE'); put(12, 'fmt '); view.setUint32(16, 16, true);
view.setUint16(20, 1, true); view.setUint16(22, channels, true);
view.setUint32(24, 48000, true); view.setUint32(28, 96000, true);
view.setUint16(32, 2, true); view.setUint16(34, 8, true);
put(36, 'data'); view.setUint32(40, frames * channels, true);
source.fill(128, 44);

const rssBefore = process.memoryUsage().rss;
const start = performance.now();
const answer = importPcmWav036(source);
const wallMs = performance.now() - start;
const rssAfter = process.memoryUsage().rss;
assert.equal(answer.wav.length, 11_520_044);
assert.equal(answer.wav[0], 82);
assert.equal(answer.sampleRate, 48000);
assert.equal(answer.channels, 2);
assert.equal(answer.sourceDurationSeconds, 60);
assert.equal(answer.wav[44], 0);
assert.equal(source[44], 128);
console.log('AUDIO036_NODE_MEMORY_RECEIPT ' + JSON.stringify({
  durationSeconds: 60, codec: 'PCM 8-bit unsigned WAV -> signed PCM16 WAV',
  sourceBytes: source.length, outputBytes: answer.wav.length, wallMs: Number(wallMs.toFixed(1)),
  rssBeforeBytes: rssBefore, rssAfterBytes: rssAfter, rssDeltaBytes: rssAfter - rssBefore,
  memoryEvidenceScope: 'single Node process before/after RSS snapshots; neither worker peak nor physical mobile',
}));
