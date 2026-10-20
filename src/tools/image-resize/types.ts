import type { ImageResampling } from "../../engines/image/resize-pica-271";
import type { SupportedImageMime } from "../../engines/image/format";

export type ImageResizeOutputMime = "image/jpeg" | "image/webp";
export type ImageResizeFit = "contain" | "cover";
export type ImageResizePhase =
  | "header"
  | "preflight"
  | "decode"
  | "resize"
  | "encode"
  | "verify";

export interface ImageResizeInput {
  file: File;
  width: number;
  height: number;
  fit: ImageResizeFit;
  noUpscale: boolean;
  outputMime: ImageResizeOutputMime;
  quality: number;
}

export interface ImageResizeProgress {
  phase: ImageResizePhase;
  label: string;
}

export interface ImageResizeOutput {
  blob: Blob;
  filename: string;
  inputMime: SupportedImageMime;
  outputMime: ImageResizeOutputMime;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  estimatedDecodedBytes: number;
  resampling: ImageResampling;
  metadataPolicy: string;
  orientationPolicy: string;
}
