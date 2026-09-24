import { comparePdfs } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFile } from "../pdf/shared";
import type { PdfCompareOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfCompareOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose two PDF files.");
    const first = requireFile((value as { first?: unknown }).first, "first PDF");
    const second = requireFile((value as { second?: unknown }).second, "second PDF");
    const comparison = await comparePdfs(first.blob, second.blob, signal);
    return { comparison, summary: comparison.summary };
  },
};

export default module;
