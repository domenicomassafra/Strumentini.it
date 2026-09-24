import { createDocumentManifest } from "../../engines/pdf";
import type { ToolModule } from "../../runtime/types";
import { requireFiles } from "../pdf/shared";
import type { DocumentHandoffManifestOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<DocumentHandoffManifestOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose files for the manifest.");
    const files = requireFiles((value as { files?: unknown }).files, "handoff files");
    const manifest = await createDocumentManifest(files.map(({ blob, filename }) => ({ blob, filename })), signal);
    return { manifest, json: manifest.json };
  },
};

export default module;
