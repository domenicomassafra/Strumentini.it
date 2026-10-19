/** #212: verified GIF still-frame extraction for the public image converter.
 * Animated output is not produced; source frame timing remains metadata only.
 */
import { gifFirstFrameToPng212 } from "./directional-212";
import { inspectGifBlob, type GifStructure } from "./gif-structure";
import { decodePortableImage, type PortableDecodedImage } from "./portable-decode";
import { abortIfNeeded, ImageVisualError, type ImageVisualFile, type ImageVisualProgress } from "./visual";

export async function decodeForConversion212(
  file: ImageVisualFile,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<{ readonly decoded: PortableDecodedImage; readonly gifSource?: GifStructure }> {
  // Verify GIF frame boundaries; a still-frame export must never silently
  // treat a source animation as if its original timing can be preserved.
  const header = new Uint8Array(await file.blob.slice(0, 6).arrayBuffer());
  abortIfNeeded(signal);
  const signature = String.fromCharCode(...header);
  const gifSource = signature === "GIF87a" || signature === "GIF89a" || /\.gif$/iu.test(file.name) || file.type === "image/gif"
    ? await inspectGifBlob(file.blob, signal)
    : undefined;

  // Firefox's native GIF first-frame renderer ignores nonzero frame offsets.
  // The independently checked LZW extractor reconstructs transparency and
  // interlacing on the logical canvas; then standard PNG/canvas validation runs.
  const gifFrame = gifSource === undefined ? undefined : await gifFirstFrameToPng212(file.blob, {
    allowAnimationLoss: true, // This public route explicitly exports only frame 1.
    ...(signal === undefined ? {} : { signal }),
  });
  if (gifFrame !== undefined && (gifFrame.width !== gifSource?.width || gifFrame.height !== gifSource.height ||
    gifFrame.frameCount !== gifSource.frameCount ||
    gifFrame.frameDelaysCentiseconds.some((delay, i) => delay !== gifSource.frameDelaysCentiseconds[i]))) {
    throw new ImageVisualError("INVALID_GIF", "GIF first frame and container metadata disagree");
  }
  const input = gifFrame === undefined ? file : {
    name: "first-frame.png",
    type: "image/png",
    size: gifFrame.png.byteLength,
    blob: new Blob([new Uint8Array(gifFrame.png)], { type: "image/png" }),
  };
  const bitmap = await decodePortableImage(input, signal, progress);
  const decoded: PortableDecodedImage = gifFrame === undefined ? bitmap : {
    ...bitmap,
    kind: "gif", mime: "image/gif", framePolicy: "first-frame-only",
  };
  return { decoded, ...(gifSource === undefined ? {} : { gifSource }) };
}
