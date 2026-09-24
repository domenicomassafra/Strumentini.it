import { imagesToPdf } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFiles, resultArtifacts } from "../pdf/shared";
import type { ImagesToPdfOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<ImagesToPdfOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose JPEG images.");
    const files = requireFiles((value as { files?: unknown }).files, "JPEG images");
    const artifact = await imagesToPdf(files.map(({ blob }) => blob), signal);
    return { ...resultArtifacts([artifact]), pageCount: artifact.pageCount ?? 0 };
  },
};

export default module;
