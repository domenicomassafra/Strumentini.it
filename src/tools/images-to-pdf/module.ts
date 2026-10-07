import { imagesToPdf } from "../../engines/pdf";
import { convertImageFormatLocal } from "../../engines/image/visual-tools";
import { createContactSheetLocal } from "../../engines/image/visual-tools";
import { identifyPortableImage } from "../../engines/image/portable-decode";
import type { ToolModule } from "../../runtime/types";
import { requireFiles, resultArtifacts } from "../pdf/shared";
import type { ImagesToPdfOutput } from "./types";

const module: ToolModule = {
  async run(value, _context, signal): Promise<ImagesToPdfOutput> {
    if (typeof value !== "object" || value === null) throw new Error("INVALID_INPUT: Choose local images.");
    const input = value as { files?: unknown; background?: unknown; quality?: unknown; order?: unknown; rotations?: unknown; pageSize?: unknown; orientation?: unknown; fit?: unknown; marginMm?: unknown; compositionMode?: unknown; contactSheetColumns?: unknown };
    const sourceFiles = requireFiles(input.files, "images");
    const order = input.order === undefined
      ? sourceFiles.map((_, index) => index + 1)
      : Array.isArray(input.order)
        ? input.order.map(Number)
        : [];
    if (order.length !== sourceFiles.length || new Set(order).size !== sourceFiles.length || order.some((item) => !Number.isInteger(item) || item < 1 || item > sourceFiles.length)) throw new Error("INVALID_INPUT: Image order must contain every selected image exactly once.");
    const files = order.map((item) => sourceFiles[item - 1]!);
    const rotationsInput = typeof input.rotations === "object" && input.rotations !== null ? input.rotations as Record<string, unknown> : {};
    const rotations: Record<number, 0 | 90 | 180 | 270> = {};
    for (const [key, value] of Object.entries(rotationsInput)) {
      const page = Number(key);
      const rotation = Number(value);
      if (!Number.isInteger(page) || page < 1 || page > files.length || ![0, 90, 180, 270].includes(rotation)) throw new Error("INVALID_INPUT: Image rotations must use image indexes and 0/90/180/270 degrees.");
      rotations[page] = rotation as 0 | 90 | 180 | 270;
    }
    const pageSize = input.pageSize === undefined ? "original" : input.pageSize;
    if (pageSize !== "original" && pageSize !== "a4" && pageSize !== "letter") throw new Error("INVALID_INPUT: Page size must be original, A4, or Letter.");
    const orientation = input.orientation === undefined ? "auto" : input.orientation;
    if (orientation !== "auto" && orientation !== "portrait" && orientation !== "landscape") throw new Error("INVALID_INPUT: Page orientation must be auto, portrait, or landscape.");
    const fit = input.fit === undefined ? "contain" : input.fit;
    if (fit !== "contain" && fit !== "cover") throw new Error("INVALID_INPUT: Image fit must be contain or cover.");
    const marginMm = typeof input.marginMm === "number" ? input.marginMm : 0;
    if (!Number.isFinite(marginMm) || marginMm < 0 || marginMm > 100) throw new Error("INVALID_INPUT: Margin must be between 0 and 100 mm.");
    const compositionMode = input.compositionMode === undefined ? "pages" : input.compositionMode;
    if (compositionMode !== "pages" && compositionMode !== "contact-sheet") throw new Error("INVALID_INPUT: Composition mode must be pages or contact-sheet.");
    const contactSheetColumns = typeof input.contactSheetColumns === "number" ? input.contactSheetColumns : 3;
    if (!Number.isInteger(contactSheetColumns) || contactSheetColumns < 1 || contactSheetColumns > 8) throw new Error("INVALID_INPUT: Contact-sheet columns must be between 1 and 8.");
    const background = typeof input.background === "string" && /^#[0-9a-f]{6}$/iu.test(input.background) ? input.background : "#ffffff";
    const quality = typeof input.quality === "number" ? input.quality : 0.92;
    let prepared: Blob[] = [];
    const conversions: Array<{ name: string; inputMime: string; embeddedAs: "original-jpeg" | "jpeg-reencode"; alphaPolicy: string; background: string | null; framePolicy: string; decoder: string }> = [];
    for (const file of files) {
      const head = new Uint8Array(await file.blob.slice(0, 512).arrayBuffer());
      const identified = identifyPortableImage(head, { name: file.filename, type: file.blob.type });
      if (identified.kind === "jpeg") {
        prepared.push(file.blob);
        conversions.push({ name: file.filename, inputMime: identified.mime, embeddedAs: "original-jpeg", alphaPolicy: "opaque-source", background: null, framePolicy: identified.framePolicy, decoder: identified.decoder });
        continue;
      }
      const converted = await convertImageFormatLocal({ file: file.blob, mime: "image/jpeg", quality, background }, signal);
      prepared.push(converted.blob);
      conversions.push({ name: file.filename, inputMime: converted.inputMime, embeddedAs: "jpeg-reencode", alphaPolicy: converted.alphaPolicy, background: converted.background, framePolicy: converted.framePolicy, decoder: converted.decoder });
    }
    let contactSheet: { width: number; height: number; columns: number; sourceCount: number } | null = null;
    if (compositionMode === "contact-sheet") {
      const contact = await createContactSheetLocal({
        files: files.map((file) => new File([file.blob], file.filename, { type: file.blob.type })),
        columns: contactSheetColumns,
        cellWidth: 320,
        cellHeight: 240,
        ordering: "selection",
      }, signal);
      const converted = await convertImageFormatLocal({ file: new File([contact.blob], "contact-sheet.png", { type: "image/png" }), mime: "image/jpeg", quality, background }, signal);
      prepared = [converted.blob];
      contactSheet = { width: contact.width, height: contact.height, columns: contact.columns, sourceCount: files.length };
    }
    const effectiveRotations = compositionMode === "pages" ? rotations : {};
    const artifact = await imagesToPdf(prepared, { pageSize, orientation, fit, marginPoints: marginMm * 72 / 25.4, rotations: effectiveRotations }, signal);
    return { ...resultArtifacts([artifact]), pageCount: artifact.pageCount ?? 0, conversions, background, quality, order, rotations: effectiveRotations, pageSize, orientation, fit, marginMm, compositionMode, contactSheetColumns, contactSheet };
  },
};

export default module;
