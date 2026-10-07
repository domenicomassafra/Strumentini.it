import { PDF_LIMITS, searchPdfTextAcrossFiles } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { checkSignal, requireFiles } from "../pdf/shared";

const module: ToolModule = {
  async run(value, _context, signal): Promise<unknown> {
    checkSignal(signal);
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose PDF files and enter a query.");
    const input = value as Record<string, unknown>;
    const files = requireFiles(input.files, "PDF files");
    const query = input.query;
    if (typeof query !== "string") throw new Error("INVALID_INPUT: Enter a search query.");
    const contextCharacters = input.contextCharacters === undefined ? undefined : Number(input.contextCharacters);
    const maxResults = input.maxResults === undefined ? undefined : Number(input.maxResults);
    const caseSensitive = input.caseSensitive === undefined ? false : input.caseSensitive;
    if (caseSensitive !== true && caseSensitive !== false) throw new Error("INVALID_INPUT: Case-sensitive mode must be on or off.");
    const totalBytes = files.reduce((total, file) => total + file.blob.size, 0);
    if (totalBytes > PDF_LIMITS.maxTotalInputBytes) throw new Error("PDF_LIMIT: Selected PDFs exceed the local total byte limit.");
    return await searchPdfTextAcrossFiles(
      files.map((file) => ({ filename: file.filename, input: file.blob })),
      {
        query,
        ...(contextCharacters === undefined ? {} : { contextCharacters }),
        ...(maxResults === undefined ? {} : { maxResults }),
        caseSensitive,
      },
      signal,
    );
  },
};

export default module;
