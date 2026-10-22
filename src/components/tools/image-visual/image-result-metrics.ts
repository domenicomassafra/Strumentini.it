import type { ComponentChildren } from "preact";
import type { VerifiedImageOutput } from "./ImageResultV2";
import { formatBytes } from "./image-result-fields";

/** Shared file/result metrics for the image workspace. */
export function imageMetrics(output: VerifiedImageOutput | undefined, sourceFiles: readonly File[]): readonly { label: string; value: ComponentChildren }[] {
  if (output === undefined) return [];
  return [
    ...(output.width !== undefined && output.height !== undefined ? [{ label: "Dimensioni risultato", value: `${output.width} × ${output.height} px` }] : []),
    { label: "Formato verificato", value: output.artifact.verification.verifiedMime ?? output.artifact.mime },
    { label: "Dimensione risultato", value: formatBytes(output.artifact.byteLength) },
    ...(sourceFiles.length > 0 ? [{ label: "Dimensione ingresso", value: formatBytes(sourceFiles.reduce((total, file) => total + file.size, 0)) }] : []),
    { label: "Verifica artifact", value: output.artifact.download.ready ? "Firma/contenitore coerenti: download abilitato" : "Verifica non superata: download bloccato" },
  ];
}
