import type { OutputArtifactKind } from "./output-artifact";

const DOWNLOADS = {
  "json-formatter": { extension: "json", mime: "application/json", kind: "structured" },
  "yaml-formatter": { extension: "yaml", mime: "application/yaml", kind: "file" },
  "toml-formatter": { extension: "toml", mime: "application/toml", kind: "file" },
  "xml-formatter-validator": { extension: "xml", mime: "application/xml", kind: "file" },
  "css-minifier": { extension: "css", mime: "text/css", kind: "text" },
  "html-minifier": { extension: "html", mime: "text/html", kind: "text" },
} as const satisfies Record<string, { extension: string; mime: string; kind: OutputArtifactKind }>;

export interface DeveloperTransformDownload {
  readonly output: string;
  readonly filename: string;
  readonly mime: string;
  readonly kind: OutputArtifactKind;
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savedPercent: number;
}

/** Only parser-approved transformed text is eligible for raw file/copy actions. */
export function developerTransformDownload(
  id: string,
  result: unknown,
  input: string,
): DeveloperTransformDownload | null {
  const definition = DOWNLOADS[id as keyof typeof DOWNLOADS];
  if (definition === undefined || typeof result !== "object" || result === null || Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  if (record.valid !== true) return null;
  const output = id === "json-formatter" || id === "yaml-formatter" || id === "toml-formatter" ? record.formatted : record.output;
  if (typeof output !== "string") return null;
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(input).byteLength;
  const outputBytes = encoder.encode(output).byteLength;
  const savedBytes = inputBytes - outputBytes;
  const svgMode = id === "xml-formatter-validator" && record.mode === "svg-minify";
  return {
    output,
    filename: `${id}-risultato.${svgMode ? "svg" : definition.extension}`,
    mime: svgMode ? "image/svg+xml" : definition.mime,
    kind: definition.kind,
    inputBytes,
    outputBytes,
    savedBytes,
    savedPercent: inputBytes === 0 ? 0 : Number((100 * savedBytes / inputBytes).toFixed(2)),
  };
}
