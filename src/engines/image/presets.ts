/*
 * Social and app image dimensions, with the arithmetic a designer actually
 * needs: which box the picture fits into, which box the platform shows, and
 * which part of the picture gets cut off.
 *
 * Every preset is data with a source and a verification date, for the same
 * reason as the social limits: these are published recommendations that change,
 * and a bare number with no provenance invites trust it has not earned.
 */

export type PlatformFit = "same-ratio" | "crop-needed" | "pad-needed";

export interface PlatformPreset {
  readonly id: string;
  readonly labelIt: string;
  readonly width: number;
  readonly height: number;
  /** What the box is for, in Italian. */
  readonly scopeIt: string;
  readonly source: string;
  readonly verifiedOn: string;
}

export const PLATFORM_PRESETS: readonly PlatformPreset[] = [
  {
    id: "instagram-square",
    labelIt: "Instagram, quadrato",
    width: 1080,
    height: 1080,
    scopeIt: "post quadrato nel riquadro principale del profilo",
    source: "Instagram Help Centre — image and video specifications",
    verifiedOn: "2026-09-23",
  },
  {
    id: "instagram-portrait",
    labelIt: "Instagram, verticale",
    width: 1080,
    height: 1350,
    scopeIt: "post verticale, il formato più alto del riquadro",
    source: "Instagram Help Centre — image and video specifications",
    verifiedOn: "2026-09-23",
  },
  {
    id: "instagram-story",
    labelIt: "Instagram e Facebook, storia",
    width: 1080,
    height: 1920,
    scopeIt: "storia e reel, formato 9:16",
    source: "Instagram Help Centre — image and video specifications",
    verifiedOn: "2026-09-23",
  },
  {
    id: "open-graph",
    labelIt: "Open Graph, link condiviso",
    width: 1200,
    height: 630,
    scopeIt: "anteprima dei link su Facebook, LinkedIn e molte altre piattaforme",
    source: "The Open Graph protocol — og:image basic metadata",
    verifiedOn: "2026-09-23",
  },
  {
    id: "youtube-thumbnail",
    labelIt: "YouTube, miniatura",
    width: 1280,
    height: 720,
    scopeIt: "miniatura del video, 16:9",
    source: "YouTube Help — custom thumbnail size",
    verifiedOn: "2026-09-23",
  },
  {
    id: "x-landscape",
    labelIt: "X, immagine del post",
    width: 1600,
    height: 900,
    scopeIt: "immagine allegata a un post, 16:9",
    source: "X Help Center — media best practices",
    verifiedOn: "2026-09-23",
  },
  {
    id: "linkedin-landscape",
    labelIt: "LinkedIn, articolo",
    width: 1200,
    height: 627,
    scopeIt: "immagine di copertina di un articolo",
    source: "LinkedIn Help — image specifications",
    verifiedOn: "2026-09-23",
  },
  {
    id: "app-icon",
    labelIt: "Icona dell'app",
    width: 1024,
    height: 1024,
    scopeIt: "icona madre da cui derivano le altre dimensioni",
    source: "Apple Human Interface Guidelines — app icons",
    verifiedOn: "2026-09-23",
  },
  {
    id: "tiktok-video-cover",
    labelIt: "TikTok, copertina",
    width: 1080,
    height: 1920,
    scopeIt: "copertina del video, 9:16",
    source: "TikTok Support — video specifications",
    verifiedOn: "2026-09-23",
  },
  {
    id: "mastodon-header",
    labelIt: "Mastodon, intestazione profilo",
    width: 1500,
    height: 500,
    scopeIt: "immagine di intestazione del profilo, 3:1",
    source: "Mastodon documentation — profile header requirements",
    verifiedOn: "2026-09-23",
  },
];

export interface PixelBox {
  readonly width: number;
  readonly height: number;
}

export interface CropBox extends PixelBox {
  readonly x: number;
  readonly y: number;
}

export interface PlatformSizeResult {
  readonly preset: PlatformPreset;
  readonly source: PixelBox;
  /** Smallest box with the preset's ratio that fits inside the source. */
  readonly contain: PixelBox;
  /** The preset box itself, filled by cropping the source to its ratio. */
  readonly cover: PixelBox;
  /** Which part of the source survives the crop, in source pixels. */
  readonly coverCrop: CropBox;
  /** Source pixels per output pixel when cropping. */
  readonly coverScale: number;
  /** How much is lost on the cropped axis. */
  readonly croppedFraction: number;
  readonly fit: PlatformFit;
  /** True when the source is already at least as large as the preset. */
  readonly meetsResolution: boolean;
  readonly upscaleFactor: number;
  readonly sourceRatio: string;
  readonly presetRatio: string;
  readonly ratioDifferencePercent: number;
}

export function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0 ? 1 : a;
}

export function ratioLabel(width: number, height: number): string {
  const divisor = gcd(width, height);
  const left = width / divisor;
  const right = height / divisor;
  // A ratio with many parts is more readable as a decimal.
  return left * right > 1000 ? `${(width / height).toFixed(3).replace(".", ",")}:1` : `${left}:${right}`;
}

/**
 * The box of the source, at the source's own resolution, that matches the
 * preset's ratio and fits inside it — the crop `cover` keeps. Centred, because
 * a centred crop is the only one a tool can honestly produce without asking the
 * reader where the subject is.
 */
export function coverCropFor(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CropBox {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const width = sourceRatio > targetRatio
    ? Math.max(1, Math.round(sourceHeight * targetRatio))
    : sourceWidth;
  const height = sourceRatio > targetRatio
    ? sourceHeight
    : Math.max(1, Math.round(sourceWidth / targetRatio));
  return {
    width,
    height,
    x: Math.round((sourceWidth - width) / 2),
    y: Math.round((sourceHeight - height) / 2),
  };
}

export function containBox(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): PixelBox {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function calculatePlatformSizes(
  preset: PlatformPreset,
  sourceWidth: number,
  sourceHeight: number,
): PlatformSizeResult {
  if (!Number.isInteger(sourceWidth) || sourceWidth < 1) throw new Error("INVALID_SOURCE_WIDTH");
  if (!Number.isInteger(sourceHeight) || sourceHeight < 1) throw new Error("INVALID_SOURCE_HEIGHT");
  const crop = coverCropFor(sourceWidth, sourceHeight, preset.width, preset.height);
  const croppedFraction = 1 - (crop.width * crop.height) / (sourceWidth * sourceHeight);
  const sourceRatio = sourceWidth / sourceHeight;
  const presetRatio = preset.width / preset.height;
  const ratioDifference = Math.abs(sourceRatio - presetRatio) / presetRatio;
  const sameRatio = ratioDifference < 0.005;
  return {
    preset,
    source: { width: sourceWidth, height: sourceHeight },
    contain: containBox(sourceWidth, sourceHeight, preset.width, preset.height),
    cover: { width: preset.width, height: preset.height },
    coverCrop: crop,
    coverScale: crop.width / preset.width,
    croppedFraction: Math.round(croppedFraction * 10_000) / 10_000,
    fit: sameRatio ? "same-ratio" : sourceRatio > presetRatio ? "crop-needed" : "pad-needed",
    meetsResolution: sourceWidth >= preset.width && sourceHeight >= preset.height,
    upscaleFactor: Math.max(
      1,
      Math.round((preset.width / Math.min(sourceWidth, crop.width)) * 100) / 100,
    ),
    sourceRatio: ratioLabel(sourceWidth, sourceHeight),
    presetRatio: ratioLabel(preset.width, preset.height),
    ratioDifferencePercent: Math.round(ratioDifference * 1000) / 10,
  };
}