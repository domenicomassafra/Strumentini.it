import {
  detectHeavyJobCapabilities,
  preflightHeavyLocalJob,
  type HeavyJobCapabilitySnapshot,
  type HeavyJobPreflightResult,
} from "../../runtime/heavy-preflight";

/**
 * Ticket #246 source-only preflight; NOT an OCR runtime or a production route.
 * #271 explicitly REFUSES promotion until physical iOS/Android and native/WASM
 * memory and cancellation evidence exists. No model, worker, URL or network
 * capability is constructed here.
 */
export const IMAGE_OCR_FEASIBILITY = {
  productionPromotion: "REFUSED_271_PHYSICAL_MOBILE_AND_TOTAL_MEMORY_UNPROVEN",
  acceptedSpikeEngine: "tesseract.js@7.0.0",
  acceptedSpikeLanguage: "ita",
  acceptedSpikeModel: "@tesseract.js-data/ita@1.0.0",
  engineLicense: "Apache-2.0",
  languageDataLicense: "MIT",
  verifiedFixture: "spikes/heavy-local-feasibility/public/corpus/ocr-it.png",
  verifiedFixtureSha256: "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b",
  supportedSpikeImageType: "image/png",
  fileHardLimitBytes: 5 * 1024 * 1024,
  pixelHardLimit: 2_000_000,
  maxDimension: 4000,
  estimatedBaseBytes: 96 * 1024 * 1024,
  estimatedBytesPerPixel: 16,
  workingSetHardLimitBytes: 160 * 1024 * 1024,
} as const;

export type ImageOcrLanguage = "ita";

export interface ImageOcrFeasibility {
  readonly state: "refused";
  readonly canRunOcr: false;
  readonly reasonCode: "OCR_PRODUCTION_REFUSED_271";
  readonly language: ImageOcrLanguage | null;
  readonly detectedType: "image/png" | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly inputBytes: number;
  readonly estimatedWorkingSetBytes: number | null;
  readonly preflight: HeavyJobPreflightResult;
  readonly errors: readonly string[];
  readonly missingPromotionEvidence: readonly string[];
  readonly confidence: null;
  readonly recognizedText: null;
  readonly networkPolicy: "no-requests";
}

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePngHeader(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 33 || PNG_HEADER.some((byte, i) => bytes[i] !== byte)) return null;
  // IHDR must be first, exactly 13 bytes, with nonzero valid sample/channel values.
  if (bytes[8] !== 0 || bytes[9] !== 0 || bytes[10] !== 0 || bytes[11] !== 13
    || bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(29, false) !== crc32(bytes.subarray(12, 29))) return null;
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  const depth = bytes[24];
  const color = bytes[25];
  if (![1, 2, 4, 8, 16].includes(depth ?? 0) || ![0, 2, 3, 4, 6].includes(color ?? -1)
    || bytes[26] !== 0 || bytes[27] !== 0 || (bytes[28] !== 0 && bytes[28] !== 1)) return null;
  if (color === 3 && depth === 16) return null;
  if (color === 3 && ![1, 2, 4, 8].includes(depth ?? 0)) return null;
  if ((color === 2 || color === 4 || color === 6) && ![8, 16].includes(depth ?? 0)) return null;
  return { width, height };
}

export function evaluateImageOcrPreflight(
  header: Uint8Array,
  inputBytes: number,
  requestedLanguage: string,
  declaredMime: string,
  capabilities: HeavyJobCapabilitySnapshot = detectHeavyJobCapabilities(),
): ImageOcrFeasibility {
  const meta = IMAGE_OCR_FEASIBILITY;
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 0) throw new RangeError("OCR input size must be a safe nonnegative integer");
  const parsed = parsePngHeader(header);
  const errors: string[] = [];
  if (requestedLanguage !== "ita") errors.push("OCR_LANGUAGE_NOT_ACCEPTED: soltanto 'ita' è provato dalla fixture italiana; inglese non autorizzato.");
  if (declaredMime !== meta.supportedSpikeImageType || parsed === null) {
    errors.push("OCR_IMAGE_UNSUPPORTED: richiesta firma e CRC IHDR PNG validi con MIME image/png; JPEG/HEIC/PDF e file corrotti non verificati.");
  }
  if (inputBytes > meta.fileHardLimitBytes || inputBytes < 33) {
    errors.push("OCR_FILE_LIMIT: file fuori limite (33 byte–5 MiB) prima di caricare WASM o modello.");
  }
  const width = parsed?.width ?? null;
  const height = parsed?.height ?? null;
  if (parsed !== null && (parsed.width < 1 || parsed.height < 1
    || parsed.width > meta.maxDimension || parsed.height > meta.maxDimension
    || parsed.width * parsed.height > meta.pixelHardLimit)) {
    errors.push("OCR_PIXEL_LIMIT: max 4000px per lato e 2 megapixel.");
  }
  const estimate = parsed !== null && parsed.width > 0 && parsed.height > 0
    ? meta.estimatedBaseBytes + parsed.width * parsed.height * meta.estimatedBytesPerPixel : null;
  const preflight = preflightHeavyLocalJob({
    capabilities: { worker: "required", wasm: "required", "image-decode": "required" },
    limits: {
      hardInputBytes: meta.fileHardLimitBytes,
      hardWorkingSetBytes: meta.workingSetHardLimitBytes,
    },
  }, { inputBytes, ...(estimate === null ? {} : { estimatedWorkingSetBytes: estimate }) }, capabilities);
  if (preflight.state !== "supported") errors.push(...preflight.reasons);
  // A successful compatibility preflight never overrides the feasibility
  // decision. Returning recognizedText/confidence would be fabricated.
  return {
    state: "refused",
    canRunOcr: false,
    reasonCode: "OCR_PRODUCTION_REFUSED_271",
    language: requestedLanguage === "ita" ? "ita" : null,
    detectedType: parsed !== null ? "image/png" : null,
    width, height, inputBytes, estimatedWorkingSetBytes: estimate,
    preflight, errors,
    missingPromotionEvidence: [
      "iOS Safari fisico: riconoscimento e peak WASM/native/RSS non misurati",
      "Android Chrome fisico: riconoscimento e peak WASM/native/RSS non misurati",
      "cancellazione durante riconoscimento, cleanup worker e limiti memory process non accettati",
      "model/worker/core non promossi al runtime di produzione; asset same-origin solo nello spike",
    ],
    recognizedText: null,
    confidence: null,
    networkPolicy: "no-requests",
  };
}

export async function inspectLocalImageOcr(
  image: File,
  language: string,
  signal?: AbortSignal,
  capabilities?: HeavyJobCapabilitySnapshot,
): Promise<ImageOcrFeasibility> {
  if (!(image instanceof File)) throw new TypeError("OCR requires a browser File");
  if (signal?.aborted) throw new DOMException("OCR preflight annullato", "AbortError");
  const eligibleBytes = image.size >= 33 && image.size <= IMAGE_OCR_FEASIBILITY.fileHardLimitBytes;
  // Never read the entire file to test dimensions. Disallowed files don't get
  // their payload opened at all.
  const header = eligibleBytes ? new Uint8Array(await image.slice(0, 33).arrayBuffer()) : new Uint8Array();
  if (signal?.aborted) throw new DOMException("OCR preflight annullato", "AbortError");
  return evaluateImageOcrPreflight(header, image.size, language, image.type, capabilities);
}
