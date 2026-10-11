/**
 * #407: Conservative, bounded checks performed before a file is offered to a
 * converter. Passing these checks never certifies a document as safe: e.g. a
 * PDF can contain uninspected objects and a ZIP can contain nested archives.
 * The caller is responsible for limiting input/reads, and for downstream
 * parser-specific quotas and isolation.
 */
export type FileThreatFinding407 = Readonly<{
  reason: "MALFORMED" | "POLYGLOT" | "TOO_LARGE" | "UNSUPPORTED";
  message: string;
}>;

export const FILE_THREAT_LIMITS_407 = {
  maxPdfWindowBytes: 128 * 1024,
  maxTextPartBytes: 128 * 1024,
  maxTotalTextBytes: 256 * 1024,
  maxTextParts: 32,
  maxZipPathDepth: 32,
  maxZipPathCharacters: 1024,
} as const;

const reject = (reason: FileThreatFinding407["reason"], message: string): FileThreatFinding407 => ({reason, message});

/** No extraction occurs here; refuse names that become dangerous on common file systems. */
export function checkZipPath407(path: string): FileThreatFinding407 | null {
  const normalized = path.normalize("NFKC");
  // Query/fragment suffixes can conceal the true SVG/XML extension in a URL;
  // Windows-forbidden characters and encoded separators are ambiguous too.
  const specialSyntax = /[?*"<>|#]|%(?:00|2e|2f|3a|3f|23|5c)/iu;
  if (!path || path.length > FILE_THREAT_LIMITS_407.maxZipPathCharacters ||
    path.startsWith("/") || path.includes("\\") || path.includes(":") ||
    /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(path) ||
    /^[A-Za-z]:/u.test(path) || normalized.startsWith("/") || normalized.includes("\\") || normalized.includes(":") ||
    normalized.includes("//") || specialSyntax.test(path) || specialSyntax.test(normalized)) {
    return reject("MALFORMED", "ZIP has a dangerous or excessively long member path.");
  }
  const segments = path.endsWith("/") ? path.slice(0, -1).split("/") : path.split("/");
  const normalizedSegments = normalized.endsWith("/") ? normalized.slice(0,-1).split("/") : normalized.split("/");
  if (segments.length > FILE_THREAT_LIMITS_407.maxZipPathDepth ||
    normalizedSegments.length !== segments.length ||
    normalizedSegments.length > FILE_THREAT_LIMITS_407.maxZipPathDepth ||
    normalizedSegments.some((part) => !part || part === "." || part === ".." || /[. ]$/u.test(part) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) {
    return reject("MALFORMED", "ZIP contains path traversal or ambiguous member paths.");
  }
  return null;
}

/** The central directory's platform/type hints must not describe links/devices. */
export function checkZipEntryType407(
  madeBy: number,
  externalAttributes: number,
  name: string,
): FileThreatFinding407 | null {
  const host = madeBy >>> 8;
  if (host === 3 || host === 19) { // UNIX or macOS
    const mode = (externalAttributes >>> 16) & 0xffff;
    const kind = mode & 0xf000;
    if (kind !== 0 && kind !== (name.endsWith("/") ? 0x4000 : 0x8000)) {
      return reject("UNSUPPORTED", "ZIP members cannot be links, devices or mismatched directories.");
    }
  }
  // DOS reparse points / directory attributes cannot be trusted as ordinary files.
  const dosAttributes = externalAttributes & 0xff;
  if ((dosAttributes & 0x10) !== 0 && !name.endsWith("/")) {
    return reject("UNSUPPORTED", "ZIP directory attributes conflict with its member name.");
  }
  return null;
}

export function textPartKind407(name: string): "xml" | "svg" | "html" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".svgz")) return "svg";
  if (lower.endsWith(".xml") || lower.endsWith(".rels") || lower === "[content_types].xml") return "xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || lower.endsWith(".xhtml")) return "html";
  return null;
}

/** Never parse XML with a DOM here: refuse entity resolution and active markup. */
export function checkTextPart407(source: string, kind: "xml" | "svg" | "html"): FileThreatFinding407 | null {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b|<\?\s*xml-stylesheet\b|<\s*(?:xi:include|xinclude:include)\b|http:\/\/www\.w3\.org\/2001\/XInclude/iu.test(source) ||
    /\bxmlns(?::[\w.-]+)?\s*=\s*["'][^"']*&/iu.test(source)) {
    return reject("UNSUPPORTED", "Embedded XML document type, entities, stylesheets or includes are not supported.");
  }
  // XML entity references are decoded by downstream parsers: an attribute such
  // as TargetMode="Ex&#x74;ernal" must not evade an external-link refusal.
  if (/\b(?:TargetMode|Target|schemaLocation|noNamespaceSchemaLocation|href|src)\s*=\s*["'][^"']*&/iu.test(source) ||
    /\b(?:TargetMode|schemaLocation|noNamespaceSchemaLocation)\s*=\s*["'][^"']*(?:external|https?:\/\/|file:\/\/)/iu.test(source) ||
    /\b(?:Target|href|src|schemaLocation|noNamespaceSchemaLocation)\s*=\s*["']\s*(?:https?:|ftp:|file:|data:|javascript:|vbscript:|\/\/|\\\\)/iu.test(source)) {
    return reject("UNSUPPORTED", "External XML package references are outside the local inspection profile.");
  }
  // XML namespace aliases can give <s:script> exactly the same active meaning
  // as <script>; inspection cannot assume the element has no prefix.
  if (/<\s*(?:[a-z_][\w.-]*:)?(?:script|iframe|object|embed)\b|\bon(?:load|error|click|mouseover|focus|begin|end)\s*=/iu.test(source)) {
    return reject("UNSUPPORTED", "Executable XML markup or event handlers are not supported.");
  }
  // A ZIP can store a genuine SVG document under an .xml member name.
  if (kind === "svg" || kind === "html" || /<\s*(?:[a-z_][\w.-]*:)?svg\b/iu.test(source)) {
    if (/<\s*(?:[a-z_][\w.-]*:)?(?:foreignObject|base|link|use|image|feImage|style|animate(?:Motion|Transform|Color)?|set|discard|handler)\b|\bon[a-z]{3,}\s*=|\b(?:href|src|xlink:href)\s*=\s*["'][^"']*&|\b(?:href|src|xlink:href)\s*=\s*["']\s*(?:https?:|file:|data:|javascript:|vbscript:|\/\/)|\burl\s*\(|@import/iu.test(source)) {
      return reject("UNSUPPORTED", "Executable or external SVG/HTML content is outside the inspection profile.");
    }
  }
  if (/\b(?:javascript|vbscript)\s*:/iu.test(source)) {
    return reject("UNSUPPORTED", "Active script references in an XML package are not supported.");
  }
  return null;
}

/** Searches observed PDF bytes only. Hidden compressed PDF objects remain unverified. */
export function checkPdfBytes407(bytes: Uint8Array): FileThreatFinding407 | null {
  // Latin-1 maps each byte to a code point and does not replace invalid UTF-8.
  const observed = new TextDecoder("iso-8859-1").decode(bytes)
    .replace(/#([0-9a-f]{2})/giu, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
  if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|OpenAction|AA|SubmitForm|ImportData|GoToR|GoToE)(?=[\s<>()\[\]{}\/%]|$)/iu.test(observed)) {
    return reject("UNSUPPORTED", "Observed PDF contains an active action or embedded content reference.");
  }
  return null;
}
