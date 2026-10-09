import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import { previewPdfTable254, exportPdfTableXlsx254, type PdfTableSelection254 } from "../../engines/pdf/pdf-table-xlsx-254";

const module: ToolModule = {
  async run(input, _context, signal) {
    if (typeof input !== "object" || input === null) throw new Error("INVALID_INPUT: PDF con pagina e regione richiesto");
    const params = input as Record<string, unknown>;
    const file = requireFile(params.file);
    if (typeof params.selection !== "object" || params.selection === null) throw new Error("INVALID_INPUT: Regione esplicita richiesta");
    const pdf = new File([file.blob], file.filename, { type: "application/pdf" });
    const preview = await previewPdfTable254(pdf, params.selection as PdfTableSelection254, signal);
    const converted = await exportPdfTableXlsx254(preview, signal);
    return {
      artifacts: [{ bytes: converted.bytes, blob: converted.blob, filename: "tabella-pdf-verificata.xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
      artifactCount: 1,
      preview, policy: converted.policy, provenance: {
        filename: preview.sourceFilename, sha256: preview.sourceSha256, page: preview.page, region: preview.region,
      },
    };
  },
};
export default module;
