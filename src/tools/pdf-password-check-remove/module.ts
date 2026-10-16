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
      const password = (value as { password?: unknown }).password;
      if (typeof password !== "string") throw new Error("PDF_PROTECTION_PASSWORD_INVALID: Password obbligatoria.");
      const { protectPdfWithPassword332 } = await import("../../engines/pdf/password-protect-local-332");
      const locked = await protectPdfWithPassword332(file.blob, password, signal);
      return { mode, encrypted: true, artifact: resultArtifacts([locked]), policy: "PDF AES-256 con password d'apertura, generato e verificato localmente; nessun upload. Conserva la password: senza non puoi aprire la copia." };
    }
    if (mode === "remove") {
      const password = (value as { password?: unknown }).password;
      if (password !== undefined && typeof password !== "string") throw new Error("PDF_PASSWORD_REQUIRED: Password non valida.");
      if (typeof password === "string" && password.length > 0) {
        const { unlockPdfWithPassword320 } = await import("../../engines/pdf/password-local-320");
        const unlocked = await unlockPdfWithPassword320(file.blob, password, signal);
        return { mode, encrypted: false, artifact: resultArtifacts([unlocked]), policy: "Copia PDF decifrata nel Worker locale con password fornita. Nessun bypass né upload." };
      }
      const artifact = await removePdfPassword(file.blob, signal);
      return { mode, encrypted: false, artifact: resultArtifacts([artifact]), policy: "No encryption bypass is attempted." };
    }
    const result = await checkPdfPassword(file.blob, signal);
    return { mode, encrypted: result.encrypted, inspected: result.inspected, policy: "No password cracking or remote verification is attempted." };
  },
};

export default module;
