import type { Mp4Inspection, Mp4TrackInspection } from "../../../engines/video/mp4-inspection";
import type { VideoTargetSizePlan } from "../../../engines/video/target-size";

export const UNKNOWN_VIDEO_VALUE = "Sconosciuto";

export function formatVideoNumber(value: number | null, maxFractionDigits = 2): string {
  return value === null || !Number.isFinite(value)
    ? UNKNOWN_VIDEO_VALUE
    : value.toLocaleString("it-IT", { maximumFractionDigits: maxFractionDigits });
}

export function formatVideoDuration(seconds: number | null): string {
  return seconds === null ? UNKNOWN_VIDEO_VALUE : `${formatVideoNumber(seconds, 3)} s`;
}

export function formatVideoRotation(degrees: Mp4TrackInspection["quarterTurnDegrees"]): string {
  return degrees === null ? UNKNOWN_VIDEO_VALUE : `${degrees}° (matrice di visualizzazione)`;
}

export function formatTrackResolution(track: Mp4TrackInspection): string {
  return track.kind === "video" && track.width !== null && track.height !== null
    ? `${formatVideoNumber(track.width)} × ${formatVideoNumber(track.height)} px`
    : UNKNOWN_VIDEO_VALUE;
}

export function formatFrameRate(track: Mp4TrackInspection): string {
  return track.frameRate === null ? UNKNOWN_VIDEO_VALUE : formatVideoNumber(track.frameRate);
}

export function formatContainerRate(inspection: Mp4Inspection): string {
  const bits = inspection.averageContainerBitrateBps;
  return bits === null ? UNKNOWN_VIDEO_VALUE : `${formatVideoNumber(bits / 1_000_000, 3)} Mbit/s (intero file)`;
}

export function formatPlanRate(bits: number | null): string {
  return bits === null ? UNKNOWN_VIDEO_VALUE : `${formatVideoNumber(bits / 1_000, 2)} kbit/s`;
}

export function planDescription(plan: VideoTargetSizePlan): string {
  return `Budget teorico ${formatVideoNumber(plan.targetBytes)} byte in ${formatVideoDuration(plan.durationSeconds)}; esito di codifica ${plan.achievesTargetSize === "unknown" ? "sconosciuto" : plan.achievesTargetSize}.`;
}
