import { checkPdfPassword, removePdfPassword } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfPasswordCheckOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfPasswordCheckOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const requestedMode = (value as { mode?: unknown }).mode;
    const mode = requestedMode === "remove" || requestedMode === "protect" ? requestedMode : "check";
    if (mode === "protect") {
      throw new Error("PDF_PASSWORD_CODEC_REMOVED_126: La protezione con password non è disponibile: il codec QPDF è stato rimosso.");
    }
    if (mode === "remove") {
      const password = (value as { password?: unknown }).password;
      if (password !== undefined && typeof password !== "string") throw new Error("PDF_PASSWORD_REQUIRED: Password non valida.");
      if (typeof password === "string" && password.length > 0)
        throw new Error("PDF_PASSWORD_CODEC_REMOVED_126: La decifratura con password non è disponibile: il codec QPDF è stato rimosso.");
      const artifact = await removePdfPassword(file.blob, signal);
      return { mode, encrypted: false, artifact: resultArtifacts([artifact]), policy: "No encryption bypass is attempted." };
    }
    const result = await checkPdfPassword(file.blob, signal);
    return { mode, encrypted: result.encrypted, inspected: result.inspected, policy: "No password cracking or remote verification is attempted." };
  },
};

export default module;
