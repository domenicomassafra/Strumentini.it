import type { ToolSummary } from "../../catalog/manifest";
import { isLocalToolRoute } from "../../catalog/manifest";
import type { LocalFileDetection, LocalFileFormat } from "../../runtime/file-detection";

/** No CSV signature contract in the detector: never infer it from MIME/suffix. */
const ROUTABLE_MIMES = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  zip: "application/zip",
} as const satisfies Partial<Record<LocalFileFormat, string>>;

type RoutableFormat = keyof typeof ROUTABLE_MIMES;
const MAX_SUGGESTIONS = 6;

/** Rank common tasks, without bypassing the manifest and route checks. */
const PREFERRED_IDS: Partial<Record<RoutableFormat, readonly string[]>> = {
  pdf: ["pdf-page-count-verifier", "pdf-merge", "pdf-compression-lite", "pdf-split", "pdf-page-reorder", "pdf-text-extraction"],
  png: ["image-compression", "image-resize", "image-format-conversion", "exif-remover", "image-metadata-viewer", "image-crop"],
  jpeg: ["image-compression", "image-resize", "image-format-conversion", "exif-remover", "image-metadata-viewer", "image-crop"],
  webp: ["image-compression", "image-resize", "image-format-conversion", "exif-remover", "image-metadata-viewer", "image-crop"],
  gif: ["image-format-conversion", "images-to-pdf"],
  zip: ["zip-contents-inspector", "archive-checksum-manifest"],
};

export interface HomeFileSuggestion335 {
  readonly format: RoutableFormat;
  readonly toolId: string;
  readonly route: string;
  readonly name: string;
}

function isRoutableFormat(format: LocalFileFormat): format is RoutableFormat {
  return Object.prototype.hasOwnProperty.call(ROUTABLE_MIMES, format);
}

/**
 * Pure fail-closed projection; never trust filenames, suffix, file bytes or a
 * generic "file" input. Published routes must originate from real Astro pages.
 * Recommendations never run a tool or transfer the selected file.
 */
export function fileSuggestions335(
  detected: LocalFileDetection,
  manifests: readonly ToolSummary[],
  publishedRoutes: ReadonlySet<string>,
): readonly HomeFileSuggestion335[] {
  if (detected.status !== "supported" || !isRoutableFormat(detected.format)) return [];
  const { format, mime } = detected;
  if (mime !== ROUTABLE_MIMES[format]) return [];

  const eligible = manifests.filter((tool) => {
    if (!tool || typeof tool.id !== "string" || !Array.isArray(tool.inputTypes)) return false;
    if (!isLocalToolRoute(tool.route) || tool.route !== "/tools/" + tool.id) return false;
    if (!publishedRoutes.has(tool.route)) return false;
    if (tool.runtime?.location !== "LOCAL" || tool.runtime.network !== "forbidden") return false;
    if (tool.result === undefined) return false;
    if (!(tool.inputTypes.includes(mime) || format === "zip" && tool.inputTypes.includes("zip"))) return false;
    if (format === "pdf") return tool.engine === "pdf";
    if (format === "zip") return tool.engine === "file-privacy";
    return tool.engine === "image" || tool.engine === "image-visual"
      || tool.engine === "pdf" && tool.id === "images-to-pdf";
  });
  const priorities = PREFERRED_IDS[format] ?? [];
  const rank = (id: string): number => {
    const index = priorities.indexOf(id);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  eligible.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const choices: HomeFileSuggestion335[] = [];
  for (const tool of eligible) {
    if (seen.has(tool.id)) continue;
    seen.add(tool.id);
    choices.push({ format, toolId: tool.id, route: tool.route, name: tool.name });
    if (choices.length === MAX_SUGGESTIONS) break;
  }
  return choices;
}
