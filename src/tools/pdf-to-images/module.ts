import { renderPdfPagesLocal } from "../../engines/pdf/render";
import { createZip, inspectZip } from "../../engines/file-privacy";
import type { ToolModule } from "../../runtime/types";
import { parsePageList, requireFile, resultArtifacts } from "../pdf/shared";
import type { PdfToImagesOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<PdfToImagesOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose a PDF file.");
    const input = value as { file?: unknown; pages?: unknown; mime?: unknown; scale?: unknown; quality?: unknown };
    const file = requireFile(input.file);
    const pages = input.pages === undefined || input.pages === "" ? undefined : parsePageList(input.pages);
    const mime = input.mime === undefined ? "image/png" : input.mime;
    if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp") throw new Error("INVALID_INPUT: Choose JPG, PNG, or WebP output.");
    const rendered = await renderPdfPagesLocal(file.blob, {
      ...(pages === undefined ? {} : { pages }),
      mime,
      ...(typeof input.scale === "number" ? { scale: input.scale } : {}),
      ...(typeof input.quality === "number" ? { quality: input.quality } : {}),
    }, signal);
    const artifacts = [...rendered.artifacts];
    let zipIncluded = false;
    let zipEntries = 0;
    if (rendered.artifacts.length > 1) {
      const files = rendered.artifacts.map((artifact) => new File([artifact.bytes.slice().buffer as ArrayBuffer], artifact.filename, { type: artifact.mime }));
      const zip = await createZip({ files }, signal);
      if (!(zip.blob instanceof Blob)) throw new Error("WRITE_FAILURE: ZIP builder did not return an archive blob.");
      const inspected = await inspectZip({ files: [new File([zip.blob], "pdf-pages.zip", { type: "application/zip" })] }, signal);
      const entries = Array.isArray(inspected.entries) ? inspected.entries : [];
      if (entries.length !== rendered.artifacts.length) throw new Error("WRITE_FAILURE: ZIP verification did not reopen every rendered page.");
      const bytes = new Uint8Array(await zip.blob.arrayBuffer());
      artifacts.push({ blob: zip.blob, bytes, filename: "pdf-pages.zip", mime: "application/zip" });
      zipIncluded = true;
      zipEntries = entries.length;
    }
    return { ...resultArtifacts(artifacts), pageCount: rendered.pageCount, selectedPages: rendered.selectedPages, mime: rendered.mime, scale: rendered.scale, effectiveDpi: rendered.effectiveDpi, quality: rendered.quality, renderer: rendered.renderer, renderedImageCount: rendered.artifacts.length, zipIncluded, zipEntries, failures: rendered.failures };
  },
};

export default module;
