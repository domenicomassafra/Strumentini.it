import { runPdfWorkspaceWorker372 } from "../../../engines/pdf/workspace-worker-client-372";
import type { PdfWorkspaceMode372 } from "../../../engines/pdf/workspace-372";
import { preparePdfResult } from "./PdfResultV2";

/** Keep the PDF verification and export policy alongside the export operation. */
export async function preparePdfPageResult372(
  file: File, order: readonly number[], selected: readonly number[],
  mode: PdfWorkspaceMode372, signal: AbortSignal,
) {
  const artifact = await runPdfWorkspaceWorker372(file, order, selected, mode, signal);
  if (signal.aborted) throw new Error("Operazione annullata");
  const selectedSet = new Set(selected);
  const prepared = await preparePdfResult("pdf-page-reorder", {
    artifacts: [artifact], artifactCount: 1,
    operation: mode === "selected" ? "extract" : "reorder",
    order: mode === "selected" ? order.filter((page) => selectedSet.has(page)) : order,
    policy: "Operazione locale; originale immutato. Il file esportato è stato riaperto con pdf-lib e con il parser PDF del risultato. Le miniature non certificano la resa visiva completa.",
  });
  if (prepared.artifacts.length !== 1 || prepared.artifacts[0]?.artifact.verification.state !== "verified") {
    throw new Error("Il risultato PDF non ha superato la verifica: nessun download.");
  }
  return prepared;
}
