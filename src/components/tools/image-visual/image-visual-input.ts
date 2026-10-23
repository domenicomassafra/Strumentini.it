import type { ImageVisualToolId } from "../../../engines/image/visual";
import { isSvgInput } from "../../../engines/image/svg-export";
import { JPEG_QUALITY_PRESETS_47, type JpegQualityPreset47 } from "../../../engines/image/jpeg-quality-presets-47";

export function buildInput(
  toolId: ImageVisualToolId, file: File | null, secondFile: File | null, files: File[],
  value: string, secondValue: string, numberValue: string, secondNumberValue: string,
  mime: string, quality: string, colorMode: string, targetKiB: string,
  minimumQuality: string, allowResize: boolean, batchMode: boolean, targetUnit: "KiB" | "MiB",
  svgWidth: string, svgHeight: string, svgScale: string, svgBackground: string,
  svgTransparent: boolean, pngLossless: boolean, pngPalette: "off" | "exact" | "lossy",
  jpegPreset: JpegQualityPreset47,
): unknown {
  const qualityNumber = Number(quality);
  const primary = file ?? files[0];
  switch (toolId) {
    case "color-blindness-image-simulation": return { file: primary, mode: colorMode === "deuteranopia" || colorMode === "tritanopia" ? colorMode : "protanopia" };
    case "image-crop": return { file: primary, x: 0, y: 0, width: Number(numberValue), height: Number(secondNumberValue), mime, quality: qualityNumber };
    case "image-format-conversion": return isSvgInput(primary)
      ? { file: primary, mime, quality: qualityNumber, width: Number(svgWidth), height: Number(svgHeight), scale: Number(svgScale), background: svgTransparent && mime !== "image/jpeg" && mime !== "application/pdf" ? "transparent" : svgBackground }
      : { file: primary, mime, quality: qualityNumber, ...(mime === "image/jpeg" ? { background: value || "#ffffff" } : {}) };
    case "image-compression": return {
      ...(batchMode ? { files } : { file: primary, mime }),
      ...(pngLossless && !batchMode ? { pngLossless: true } : {}),
      ...(pngPalette !== "off" && !batchMode ? { pngPalette } : {}),
      quality: !batchMode && mime === "image/jpeg" && jpegPreset !== "custom"
        ? JPEG_QUALITY_PRESETS_47[jpegPreset] : qualityNumber,
      ...(targetKiB.trim() === "" ? {} : { targetKiB: Number(targetKiB) * (targetUnit === "MiB" ? 1024 : 1), minQuality: Number(minimumQuality), allowResize }),
    };
    case "aspect-ratio-calculator": return { width: Number(numberValue), height: Number(secondNumberValue) };
    case "platform-size-presets": return { presetId: value || "instagram-square", width: Number(numberValue), height: Number(secondNumberValue) };
    case "image-metadata-viewer": return primary ?? null;
    case "exif-remover": return { file: primary };
    case "color-picker": return { hex: value || "#336699" };
    case "color-converter": return { color: value || (colorMode === "named-color" ? "rebeccapurple" : "#336699"), mode: colorMode };
    case "contrast-checker": return { foreground: value || "#000000", background: secondValue || "#ffffff" };
    case "palette-extractor": return { file: primary, count: Number(numberValue) };
    case "dominant-color-extractor": return primary ?? null;
    case "image-dimensions-batch-inspector": return files;
    case "image-rename-batch-preview": return { files, prefix: value, suffix: secondValue, start: Number(numberValue) };
    case "contact-sheet-generator": return { files, columns: Number(numberValue), cellWidth: 240, cellHeight: 180, ordering: value || "selection" };
    case "favicon-app-icon-size-generator": return { file: primary, sizes: [16, 32, 48, 64, 128, 180, 192, 512] };
    case "screenshot-border-background-helper": return { file: primary, border: Number(numberValue), padding: Number(secondNumberValue), background: value || "#ffffff" };
    case "image-compare-slider": return primary === null || secondFile === null ? null : { first: primary, second: secondFile };
    case "perceptual-duplicate-finder": return { files };
  }
}
