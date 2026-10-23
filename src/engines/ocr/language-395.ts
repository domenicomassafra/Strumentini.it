import {
  OCR_LOCAL_ASSETS_246, recognizeLocalItalianOcr246,
  type OcrOptions246, type OcrResult246, type OcrWorker246,
} from "./local-italian-246";

export type OcrLanguage395 = "ita" | "eng";
export type OcrResult395 = Omit<OcrResult246, "language"> & { readonly language: OcrLanguage395 };
export type OcrRunOptions395 = Omit<OcrOptions246, "language" | "createWorker">;

export const OCR_ENGLISH_ASSETS_395 = Object.freeze({
  language: "eng" as const,
  model: "@tesseract.js-data/eng@1.0.0",
  languageUrl: "/ocr-395/lang",
  modelUrl: "/ocr-395/lang/eng.traineddata.gz",
  sha256: "ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468",
});

async function loadEnglishWorker395(onProgress?: OcrRunOptions395["onProgress"]): Promise<OcrWorker246> {
  if (typeof window === "undefined") throw new Error("OCR395_BROWSER_ONLY");
  const local = (path: string) => {
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin) throw new Error("OCR395_OFFSITE_ASSET_REFUSED");
    return url.href;
  };
  // Reuse Tesseract.js 7 and local core; only ENG language data differs.
  const runtime = await import(/* @vite-ignore */ local(OCR_LOCAL_ASSETS_246.apiUrl)) as {
    default: { createWorker: (language: string, oem: number, settings: Record<string, unknown>) => Promise<OcrWorker246> };
  };
  if (typeof runtime.default?.createWorker !== "function") throw new Error("OCR395_DONOR_MODULE_INVALID");
  return runtime.default.createWorker("eng", 1, {
    workerPath: local(OCR_LOCAL_ASSETS_246.workerUrl),
    corePath: local(OCR_LOCAL_ASSETS_246.coreUrl),
    langPath: local(OCR_ENGLISH_ASSETS_395.languageUrl),
    gzip: true,
    cacheMethod: "none",
    workerBlobURL: false,
    logger: (event: { status?: string; progress?: number }) => {
      if (typeof event.status === "string") onProgress?.(event.status, Number(event.progress) || 0);
    },
  });
}

export async function recognizeLocalOcr395(
  image: File, language: OcrLanguage395, options: OcrRunOptions395 = {},
): Promise<OcrResult395> {
  if (language === "ita") return recognizeLocalItalianOcr246(image, options);
  if (language !== "eng") throw new Error("OCR395_LANGUAGE_REFUSED");
  // #246 validates PNG, memory, animation, rotation, abort and timeout.
  // Its legacy IT-only language preflight is used for structural checks;
  // the actual worker and the reported language here use pinned ENG.
  const result = await recognizeLocalItalianOcr246(image, {
    ...options, language: "ita",
    createWorker: () => loadEnglishWorker395(options.onProgress),
  });
  return { ...result, language: "eng" };
}
