import type { ToolModule } from "../../runtime/types";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { compressOoxmlEmbeddedMedia } from "../../engines/ooxml/media-compress";
import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS, OoxmlPackageError } from "../../engines/ooxml/package";

const MIMES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

const module: ToolModule = {
  async run(input, _context, signal) {
    if (!input || typeof input !== "object") throw new OoxmlPackageError("INVALID_INPUT", "Seleziona un documento Office.");
    const req = input as Record<string, unknown>;
    if (!(req.file instanceof Blob) || req.file.size < 1 || req.file.size > OOXML_PACKAGE_LIMITS.maxInputBytes) {
      throw new OoxmlPackageError("INVALID_INPUT", "Seleziona un DOCX, PPTX o XLSX locale entro 20 MiB.");
    }
    const filename = typeof (req.file as File).name === "string" ? (req.file as File).name : "";
    if (!/^[^/\\]{1,160}\.(?:docx|pptx|xlsx)$/iu.test(filename)) throw new OoxmlPackageError("INVALID_INPUT", "Il file deve avere estensione DOCX, PPTX o XLSX.");
    const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase() as keyof typeof MIMES;
    const approveLossyJpeg = req.approveLossyJpeg === true;
    const approveLossyWebp = req.approveLossyWebp === true;
    const approveResize = req.approveResize === true;
    const profile = req.profile ?? "balanced";
    if (profile !== "conservative" && profile !== "balanced" && profile !== "compact") {
      throw new OoxmlPackageError("INVALID_INPUT", "Profilo OOXML non riconosciuto.");
    }
    const quality = req.jpegQuality;
    const maxDimension = req.maxDimension;
    if (typeof quality !== "number" || !Number.isFinite(quality) || quality < 0.35 || quality > 0.9) {
      throw new OoxmlPackageError("INVALID_INPUT", "Qualità JPEG tra 0,35 e 0,90.");
    }
    if (approveResize && (typeof maxDimension !== "number" || !Number.isInteger(maxDimension) || maxDimension < 32 || maxDimension > 4096)) {
      throw new OoxmlPackageError("INVALID_INPUT", "Dimensione massima valida tra 32 e 4096 pixel.");
    }
    const source = new Uint8Array(await req.file.arrayBuffer());
    if (analyzeOoxmlPackage(source).kind !== ext) {
      throw new OoxmlPackageError("UNSUPPORTED_PACKAGE_KIND", "L'estensione del documento non coincide con il contenuto Office.");
    }
    const result = await compressOoxmlEmbeddedMedia(source, {
      approveLossyJpeg,
      approveLossyWebp,
      profile,
      jpegQuality: quality,
      approveResize,
      ...(approveResize ? { maxDimension: maxDimension as number } : {}),
      ...(signal ? { signal } : {}),
    });
    const output = analyzeOoxmlPackage(result.bytes);
    if (output.kind !== ext || output.entryCount !== result.input.entryCount) throw new OoxmlPackageError("REBUILD_VERIFICATION_FAILED", "Verifica finale del documento Office non superata.");
    const safeBase = filename.slice(0, filename.lastIndexOf(".")).normalize("NFKC").replace(/[^\p{L}\p{N}._-]/gu, "-").slice(0, 100).replace(/^[.-]+|[.-]+$/gu, "") || "documento";
    const name = `${safeBase}-media-ottimizzati.${ext}`;
    const artifact = createOutputArtifactDescriptor({
      kind: "file", name, mime: MIMES[ext], bytes: new Uint8Array(result.bytes),
      fidelity: result.parts.some((p) => p.fidelity === "approved-lossy-recode-or-resize") ? "lossy" : "structural",
      fidelityNote: result.fidelityWarning,
      verification: {
        state: "verified", verifiedMime: MIMES[ext],
        method: "OOXML bounded ZIP preflight + verified member XML/rels exactness + independent unzip/reopen",
        signature: "PK + OOXML required members",
      },
    });
    if (!artifact.download.ready) throw new OoxmlPackageError("REBUILD_VERIFICATION_FAILED", "File Office prodotto non verificabile.");
    return { ...result, artifact };
  },
};

export default module;
