import { checkPdfPassword, removePdfPassword } from "../../engines/pdf";
import { runPasswordJob417 } from "../../engines/pdf/password-client-417";
import type { ToolModule } from "../../runtime/types";
import { requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfPasswordCheckOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfPasswordCheckOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const file = requireFile((value as { file?: unknown }).file);
    const requestedMode = (value as { mode?: unknown }).mode;
    const mode = requestedMode === "remove" || requestedMode === "protect" ? requestedMode : "check";
    const password = (value as { password?: unknown }).password;
    if (password !== undefined && typeof password !== "string") throw new Error("PDF_PASSWORD_REQUIRED");
    if (mode === "protect") {
      const bytes = await runPasswordJob417(file.blob, "protect", password ?? "", signal);
      const artifact = { bytes, blob: new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
        filename: "protetto-aes256.pdf", mime: "application/pdf" as const };
      return { mode, encrypted: true, artifact: resultArtifacts([artifact]), policy: "AES-256 locale; password mai salvata o trasmessa." };
    }
    if (mode === "remove") {
      if (typeof password === "string" && password.length > 0) {
        const bytes = await runPasswordJob417(file.blob, "remove", password, signal);
        const artifact = { bytes, blob: new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
          filename: "sbloccato.pdf", mime: "application/pdf" as const };
        return { mode, encrypted: false, artifact: resultArtifacts([artifact]), policy: "Sblocco locale solo con password valida; nessun bypass." };
      }
      const artifact = await removePdfPassword(file.blob, signal);
      return { mode, encrypted: false, artifact: resultArtifacts([artifact]), policy: "No encryption bypass is attempted." };
    }
    const result = await checkPdfPassword(file.blob, signal);
    return { mode, encrypted: result.encrypted, inspected: result.inspected, policy: "No password cracking or remote verification is attempted." };
  },
};

export default module;
