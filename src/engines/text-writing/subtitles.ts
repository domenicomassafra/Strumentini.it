export const SUBTITLE_MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const SUBTITLE_MAX_CUES = 50_000;
export const SUBTITLE_DEFAULT_READING_SPEED_CPS = 17;
export const SUBTITLE_READING_SPEED_MIN_CPS = 1;
export const SUBTITLE_READING_SPEED_MAX_CPS = 100;
export const SUBTITLE_MAX_OFFSET_MS = 24 * 60 * 60 * 1000;
export const SUBTITLE_MIN_SCALE = 0.01;
export const SUBTITLE_MAX_SCALE = 100;

export const SUBTITLE_READING_SPEED_REFERENCE = {
  id: "netflix-italian-ttsg",
  label: "Netflix Italian Timed Text Style Guide — adult subtitles: up to 17 characters/second",
  url: "https://partnerhelp.netflixstudios.com/hc/en-us/articles/215349898-Italian-Timed-Text-Style-Guide",
  checkedAt: "2026-10-06",
} as const;

export type SubtitleFormat = "srt" | "vtt";
export type SubtitleOutputKind = SubtitleFormat | "transcript";
export type SubtitleNegativeOffsetPolicy = "clamp" | "refuse";

export interface SubtitleCue {
  readonly sourceCue: number;
  readonly sourceTimingLine: number;
  readonly identifier: string | null;
  readonly startMs: number;
  readonly endMs: number;
  readonly textLines: readonly string[];
}

export interface SubtitleDiagnostic {
  readonly kind: "overlap" | "out-of-order" | "reading-speed";
  readonly cue: number;
  readonly relatedCue?: number;
  readonly message: string;
}

export interface SubtitleReadingSpeed {
  readonly cue: number;
  readonly characters: number;
  readonly durationSeconds: number;
  readonly charactersPerSecond: number;
  readonly thresholdCps: number;
  readonly overThreshold: boolean;
}

export interface SubtitleProcessInput {
  readonly text: string;
  readonly sourceFormat?: SubtitleFormat | "auto";
  readonly output?: SubtitleOutputKind;
  readonly offsetMs?: number;
  readonly scale?: number;
  readonly negativeOffsetPolicy?: SubtitleNegativeOffsetPolicy;
  readonly readingSpeedCps?: number;
}

export interface SubtitleProcessResult {
  readonly sourceFormat: SubtitleFormat;
  readonly outputKind: SubtitleOutputKind;
  readonly output: string;
  readonly subtitleOutput: string;
  readonly transcript: string;
  readonly cues: readonly SubtitleCue[];
  readonly cueCount: number;
  readonly offsetMs: number;
  readonly scale: number;
  readonly transformOrder: "rescale-then-offset";
  readonly negativeOffsetPolicy: SubtitleNegativeOffsetPolicy;
  readonly clampedCueCount: number;
  readonly diagnostics: readonly SubtitleDiagnostic[];
  readonly overlapCount: number;
  readonly outOfOrderCount: number;
  readonly readingSpeed: readonly SubtitleReadingSpeed[];
  readonly readingSpeedIssueCount: number;
  readonly readingSpeedThresholdCps: number;
  readonly readingSpeedThresholdSource: string;
  readonly readingSpeedThresholdConfiguredBy: "reference-default" | "user";
  readonly supportedSubset: string;
}

interface SourceLine {
  readonly text: string;
  readonly line: number;
}

function invalid(code: string, line?: number, cue?: number): never {
  const location = [line === undefined ? "" : `line=${line}`, cue === undefined ? "" : `cue=${cue}`]
    .filter((part) => part !== "")
    .join("|");
  throw new Error(`INVALID_SUBTITLE_${code}${location === "" ? "" : `|${location}`}`);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

function assertInputBounds(text: string): void {
  if (new TextEncoder().encode(text).byteLength > SUBTITLE_MAX_INPUT_BYTES) invalid("INPUT_TOO_LARGE");
}

/** Millisecond timestamps must remain exact integers after decimal parsing. */
function timestampMilliseconds(hours: string, minutes: string, seconds: string, millis: string): number | null {
  const result = (((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000) + Number(millis);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

function parseSrtTimestamp(value: string): number | null {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/u.exec(value);
  if (match === null) return null;
  return timestampMilliseconds(match[1]!, match[2]!, match[3]!, match[4]!);
}

function parseVttTimestamp(value: string): number | null {
  const hours = /^(\d{2,}):([0-5]\d):([0-5]\d)\.(\d{3})$/u.exec(value);
  if (hours !== null) {
    return timestampMilliseconds(hours[1]!, hours[2]!, hours[3]!, hours[4]!);
  }
  const minutes = /^([0-5]\d):([0-5]\d)\.(\d{3})$/u.exec(value);
  if (minutes === null) return null;
  return timestampMilliseconds("0", minutes[1]!, minutes[2]!, minutes[3]!);
}

function parseTimingLine(value: string, format: SubtitleFormat, line: number, cue: number): { startMs: number; endMs: number } {
  const arrow = value.indexOf("-->");
  if (arrow < 0 || value.indexOf("-->", arrow + 3) >= 0) invalid("MALFORMED_TIMING", line, cue);
  const left = value.slice(0, arrow).trim();
  const right = value.slice(arrow + 3).trim();
  if (right.includes(" ") || right.includes("\t")) invalid("UNSUPPORTED_CUE_SETTINGS", line, cue);
  const parse = format === "srt" ? parseSrtTimestamp : parseVttTimestamp;
  const startMs = parse(left);
  const endMs = parse(right);
  if (startMs === null || endMs === null) invalid("MALFORMED_TIMING", line, cue);
  if (endMs <= startMs) invalid("NON_POSITIVE_DURATION", line, cue);
  return { startMs, endMs };
}

function nonEmptyBlocks(lines: readonly SourceLine[]): SourceLine[][] {
  const blocks: SourceLine[][] = [];
  let current: SourceLine[] = [];
  const flush = () => {
    if (current.length === 0) return;
    blocks.push(current);
    current = [];
  };
  for (const line of lines) {
    if (line.text.trim() === "") flush();
    else current.push(line);
  }
  flush();
  return blocks;
}

function detectSubtitleFormat(text: string, requested: SubtitleFormat | "auto"): SubtitleFormat {
  if (requested !== "auto") return requested;
  const first = normalizeLineEndings(text).replace(/^\uFEFF/u, "").split("\n", 1)[0]?.trim() ?? "";
  return /^WEBVTT(?:[ \t].*)?$/u.test(first) ? "vtt" : "srt";
}

function parseCueBlock(block: readonly SourceLine[], format: SubtitleFormat, cueNumber: number): SubtitleCue {
  if (format === "vtt" && /^(?:NOTE|STYLE|REGION)(?:\s|$)/u.test(block[0]?.text ?? "")) {
    invalid("UNSUPPORTED_BLOCK", block[0]?.line, cueNumber);
  }
  let timingIndex = 0;
  let identifier: string | null = null;
  if (!(block[0]?.text ?? "").includes("-->")) {
    identifier = block[0]?.text ?? null;
    timingIndex = 1;
    if (format === "srt" && !/^\d+$/u.test(identifier ?? "")) invalid("MALFORMED_IDENTIFIER", block[0]?.line, cueNumber);
  }
  const timing = block[timingIndex];
  if (timing === undefined) invalid("MISSING_TIMING", block[0]?.line, cueNumber);
  const { startMs, endMs } = parseTimingLine(timing.text, format, timing.line, cueNumber);
  const textLines = block.slice(timingIndex + 1).map((line) => line.text);
  if (textLines.length === 0) invalid("EMPTY_CUE", timing.line, cueNumber);
  return {
    sourceCue: cueNumber,
    sourceTimingLine: timing.line,
    identifier,
    startMs,
    endMs,
    textLines,
  };
}

export function parseSubtitles(textValue: string, requestedFormat: SubtitleFormat | "auto" = "auto"): { format: SubtitleFormat; cues: readonly SubtitleCue[] } {
  if (typeof textValue !== "string") invalid("INPUT_REQUIRED");
  assertInputBounds(textValue);
  const text = normalizeLineEndings(textValue).replace(/^\uFEFF/u, "");
  if (text.trim() === "") invalid("INPUT_REQUIRED");
  const format = detectSubtitleFormat(text, requestedFormat);
  let sourceLines = text.split("\n").map((line, index) => ({ text: line, line: index + 1 }));
  if (format === "vtt") {
    const header = sourceLines[0];
    if (header === undefined || !/^WEBVTT(?:[ \t].*)?$/u.test(header.text.trim()) || header.text.includes("-->")) invalid("VTT_HEADER", header?.line ?? 1);
    sourceLines = sourceLines.slice(1);
  }
  const blocks = nonEmptyBlocks(sourceLines);
  if (blocks.length === 0) invalid("NO_CUES");
  if (blocks.length > SUBTITLE_MAX_CUES) invalid("TOO_MANY_CUES");
  const cues = blocks.map((block, index) => parseCueBlock(block, format, index + 1));
  return { format, cues };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function formatTimestamp(ms: number, format: SubtitleFormat): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  const fraction = format === "srt" ? "," : ".";
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${fraction}${pad(millis, 3)}`;
}

export function serializeSubtitles(cues: readonly SubtitleCue[], format: SubtitleFormat): string {
  const blocks = cues.map((cue, index) => {
    const timing = `${formatTimestamp(cue.startMs, format)} --> ${formatTimestamp(cue.endMs, format)}`;
    if (format === "srt") return `${index + 1}\n${timing}\n${cue.textLines.join("\n")}`;
    const identifier = cue.identifier === null || /^\d+$/u.test(cue.identifier) ? "" : `${cue.identifier}\n`;
    return `${identifier}${timing}\n${cue.textLines.join("\n")}`;
  });
  return `${format === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n\n")}\n`;
}

export function subtitleTranscript(cues: readonly SubtitleCue[]): string {
  return `${cues.map((cue) => cue.textLines.join(" ").replace(/\s+/gu, " ").trim()).join("\n")}\n`;
}

function assertScale(value: unknown): number {
  const scale = value === undefined ? 1 : Number(value);
  if (!Number.isFinite(scale) || scale < SUBTITLE_MIN_SCALE || scale > SUBTITLE_MAX_SCALE) invalid("SCALE_RANGE");
  return scale;
}

function assertOffset(value: unknown): number {
  const offset = value === undefined ? 0 : Number(value);
  if (!Number.isSafeInteger(offset) || Math.abs(offset) > SUBTITLE_MAX_OFFSET_MS) invalid("OFFSET_RANGE");
  return offset;
}

function assertThreshold(value: unknown): { threshold: number; configuredBy: "reference-default" | "user"; source: string } {
  const configuredBy = value === undefined ? "reference-default" : "user";
  const threshold = value === undefined ? SUBTITLE_DEFAULT_READING_SPEED_CPS : Number(value);
  if (!Number.isFinite(threshold) || threshold < SUBTITLE_READING_SPEED_MIN_CPS || threshold > SUBTITLE_READING_SPEED_MAX_CPS) invalid("READING_SPEED_RANGE");
  const source = configuredBy === "reference-default"
    ? `${SUBTITLE_READING_SPEED_REFERENCE.label}. Reference threshold only; not universal truth.`
    : `User-configured threshold: ${threshold} characters/second. Reference context: ${SUBTITLE_READING_SPEED_REFERENCE.label}; suitability varies by audience and content.`;
  return { threshold, configuredBy, source };
}

function transformCues(
  cues: readonly SubtitleCue[],
  scale: number,
  offsetMs: number,
  negativePolicy: SubtitleNegativeOffsetPolicy,
): { cues: SubtitleCue[]; clampedCueCount: number } {
  let clampedCueCount = 0;
  const transformed = cues.map((cue) => {
    let startMs = Math.round(cue.startMs * scale);
    let endMs = Math.round(cue.endMs * scale);
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs)) {
      invalid("TIME_RANGE", cue.sourceTimingLine, cue.sourceCue);
    }
    if (endMs <= startMs) invalid("RESCALE_COLLAPSE", cue.sourceTimingLine, cue.sourceCue);
    startMs += offsetMs;
    endMs += offsetMs;
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs)) {
      invalid("TIME_RANGE", cue.sourceTimingLine, cue.sourceCue);
    }
    if (startMs < 0) {
      if (negativePolicy === "refuse") invalid("NEGATIVE_OFFSET", cue.sourceTimingLine, cue.sourceCue);
      const correction = -startMs;
      startMs = 0;
      endMs += correction;
      clampedCueCount += 1;
    }
    return { ...cue, startMs, endMs };
  });
  return { cues: transformed, clampedCueCount };
}

function cueReadableText(cue: SubtitleCue): string {
  return cue.textLines.join(" ").replace(/\s+/gu, " ").trim();
}

function analyzeCues(cues: readonly SubtitleCue[], thresholdCps: number): {
  diagnostics: SubtitleDiagnostic[];
  readingSpeed: SubtitleReadingSpeed[];
} {
  const diagnostics: SubtitleDiagnostic[] = [];
  const readingSpeed: SubtitleReadingSpeed[] = [];
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!;
    const previous = index === 0 ? undefined : cues[index - 1];
    if (previous !== undefined && cue.startMs < previous.endMs) {
      diagnostics.push({ kind: "overlap", cue: cue.sourceCue, relatedCue: previous.sourceCue, message: `Cue ${cue.sourceCue} starts before cue ${previous.sourceCue} ends.` });
    }
    if (previous !== undefined && cue.startMs < previous.startMs) {
      diagnostics.push({ kind: "out-of-order", cue: cue.sourceCue, relatedCue: previous.sourceCue, message: `Cue ${cue.sourceCue} starts earlier than the preceding cue.` });
    }
    const characters = Array.from(cueReadableText(cue)).length;
    const durationSeconds = (cue.endMs - cue.startMs) / 1000;
    const charactersPerSecond = characters / durationSeconds;
    const overThreshold = charactersPerSecond > thresholdCps;
    readingSpeed.push({ cue: cue.sourceCue, characters, durationSeconds, charactersPerSecond, thresholdCps, overThreshold });
    if (overThreshold) {
      diagnostics.push({ kind: "reading-speed", cue: cue.sourceCue, message: `Cue ${cue.sourceCue} is ${charactersPerSecond.toFixed(2)} characters/second against the configured ${thresholdCps} CPS reference threshold.` });
    }
  }
  return { diagnostics, readingSpeed };
}

export function processSubtitles(input: SubtitleProcessInput): SubtitleProcessResult {
  if (typeof input !== "object" || input === null || typeof input.text !== "string") invalid("INPUT_REQUIRED");
  const requestedFormat = input.sourceFormat ?? "auto";
  if (!["auto", "srt", "vtt"].includes(requestedFormat)) invalid("SOURCE_FORMAT");
  const outputKind = input.output ?? "vtt";
  if (!["srt", "vtt", "transcript"].includes(outputKind)) invalid("OUTPUT_KIND");
  const negativeOffsetPolicy = input.negativeOffsetPolicy ?? "refuse";
  if (negativeOffsetPolicy !== "clamp" && negativeOffsetPolicy !== "refuse") invalid("NEGATIVE_POLICY");
  const scale = assertScale(input.scale);
  const offsetMs = assertOffset(input.offsetMs);
  const threshold = assertThreshold(input.readingSpeedCps);
  const parsed = parseSubtitles(input.text, requestedFormat as SubtitleFormat | "auto");
  const transformed = transformCues(parsed.cues, scale, offsetMs, negativeOffsetPolicy);
  const analysis = analyzeCues(transformed.cues, threshold.threshold);
  const transcript = subtitleTranscript(transformed.cues);
  const subtitleFormat: SubtitleFormat = outputKind === "transcript" ? parsed.format : outputKind;
  const subtitleOutput = serializeSubtitles(transformed.cues, subtitleFormat);
  return {
    sourceFormat: parsed.format,
    outputKind: outputKind as SubtitleOutputKind,
    output: outputKind === "transcript" ? transcript : subtitleOutput,
    subtitleOutput,
    transcript,
    cues: transformed.cues,
    cueCount: transformed.cues.length,
    offsetMs,
    scale,
    transformOrder: "rescale-then-offset",
    negativeOffsetPolicy,
    clampedCueCount: transformed.clampedCueCount,
    diagnostics: analysis.diagnostics,
    overlapCount: analysis.diagnostics.filter((item) => item.kind === "overlap").length,
    outOfOrderCount: analysis.diagnostics.filter((item) => item.kind === "out-of-order").length,
    readingSpeed: analysis.readingSpeed,
    readingSpeedIssueCount: analysis.diagnostics.filter((item) => item.kind === "reading-speed").length,
    readingSpeedThresholdCps: threshold.threshold,
    readingSpeedThresholdSource: threshold.source,
    readingSpeedThresholdConfiguredBy: threshold.configuredBy,
    supportedSubset: "SRT cues with optional numeric indices and strict hh:mm:ss,mmm timings; WebVTT cues with optional identifiers and strict timestamps. Cue settings and NOTE/STYLE/REGION blocks are rejected explicitly.",
  };
}
