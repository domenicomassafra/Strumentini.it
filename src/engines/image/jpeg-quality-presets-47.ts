/** Browser Canvas quality hints. These do not imply codec expert controls. */
export const JPEG_QUALITY_PRESETS_47 = {
  normal: 0.84,
  compact: 0.55,
} as const;

export type JpegQualityPreset47 = keyof typeof JPEG_QUALITY_PRESETS_47 | "custom";
