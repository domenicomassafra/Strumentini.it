import { repairPdfInWorker418 } from "../../engines/pdf/repair-worker-client-418";
import type { ToolModule } from "../../runtime/types";
import { mutationInput, resultArtifacts } from "../pdf/shared";

const module: ToolModule = {
  async run(value, _context, signal) {
    const { file } = mutationInput(value);
    if (file.blob.size < 50 || file.blob.size > 4 * 1024 * 1024) {
      throw new Error("PDF418_LIMIT: Recovery is limited to PDFs under 4 MiB.");
    }
    const source = new Uint8Array(await file.blob.arrayBuffer());
    const verified = await repairPdfInWorker418(source, signal);
    const bytes = verified.bytes;
    const filename = file.filename.replace(/\.pdf$/iu, "").slice(0, 120) + "-repaired.pdf";
    const artifact = {
      blob: new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
      bytes,
      filename,
      mime: "application/pdf" as const,
      pageCount: verified.pageCount,
    };
    return {
      ...resultArtifacts([artifact]),
      profile: verified.profile,
      changedByteRange: verified.changedByteRange,
      losses: verified.losses,
      note: verified.note,
      policy: "Corregge unicamente il puntatore startxref singolo e danneggiato. Documenti cifrati, firmati, incrementali, compressi o ambigui sono rifiutati. L'originale rimane invariato; il risultato viene riaperto con lettori indipendenti.",
    };
  },
};

export default module;
