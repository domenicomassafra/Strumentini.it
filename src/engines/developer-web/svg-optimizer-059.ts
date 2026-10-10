import { invalid } from "./types";
import { gzipSync } from "fflate";

/**
 * Donor: SVG Optimizer (SVGO) 4.1.0, MIT, https://github.com/svg/svgo.
 * Feature-limited LOCAL optimization of *static vector primitives only*.
 * This is not an SVG sanitizer for rendering hostile markup. Potentially
 * active/remote/complex SVG is rejected, never 'cleaned up' silently.
 */
const ELEMENTS = new Set([
  "svg", "g", "defs", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path",
  "linearGradient", "radialGradient", "stop", "clipPath", "title", "desc", "metadata",
]);
const MAX_SOURCE_BYTES = 256 * 1024;
const encoder = new TextEncoder();

export async function optimizeStaticSvg059(source: string, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("SVG optimization cancelled", "AbortError");
  const inputBytes = encoder.encode(source).length;
  if (inputBytes === 0 || inputBytes > MAX_SOURCE_BYTES) invalid("INVALID_SVG", "Only static SVG documents up to 256 KiB are supported.");
  if (!/^\s*(?:<\?xml\s[^>]*\?>\s*)?<svg(?:\s|>)/u.test(source)) {
    invalid("INVALID_SVG", "Expected a standalone root SVG document, not embedded markup.");
  }
  // Refuse DTD, processing instructions and entity references rather than
  // relying on browser-dependent entity expansion or XML networking behavior.
  if (/<!\s*(?:DOCTYPE|ENTITY|\[CDATA\[)/iu.test(source) || /<\?(?!xml\s)/iu.test(source)) {
    invalid("SVG_UNSAFE_CONTENT", "DTD, custom entities, CDATA and processing instructions are unsupported.");
  }
  const { optimize } = await import("svgo");
  if (signal?.aborted) throw new DOMException("SVG optimization cancelled", "AbortError");
  try {
    const result = optimize(source, {
      multipass: false,
      js2svg: { pretty: false },
      plugins: [
        {
          name: "strumentini-static-svg-safety-boundary",
          fn: () => ({
            element: {
              enter(node) {
                if (!ELEMENTS.has(node.name)) throw new Error("SVG_UNSAFE_CONTENT: unsupported element " + node.name);
                for (const [attribute, value] of Object.entries(node.attributes)) {
                  if (attribute === "xmlns" && value === "http://www.w3.org/2000/svg") continue;
                  if (/^on/i.test(attribute) || attribute === "style" || attribute === "src" ||
                      (attribute === "href" || attribute.endsWith(":href")) ||
                      /url\s*\(\s*(?!['"]?#)/iu.test(value) ||
                      /(?:javascript|data|https?|file|blob)\s*:/iu.test(value)) {
                    throw new Error("SVG_UNSAFE_CONTENT: active or external SVG reference");
                  }
                }
              },
            },
          }),
        },
        "removeComments",
        "removeMetadata",
      ],
    });
    if (signal?.aborted) throw new DOMException("SVG optimization cancelled", "AbortError");
    if (!result.data.startsWith("<svg") || result.data.length === 0) invalid("INVALID_SVG", "SVGO did not emit a canonical SVG root.");
    // A safe optimizer must not silently enlarge the file; preserve source
    // byte-for-byte if there is no real saving.
    const output = encoder.encode(result.data).length < inputBytes ? result.data : source;
    const outputBytes = encoder.encode(output).length;
    // Real gzip payload sizes measured on the exact input/output UTF-8 bytes;
    // they are information, not an additional file transform or guaranteed win.
    const inputGzipBytes = gzipSync(encoder.encode(source), { level: 6 }).byteLength;
    const outputGzipBytes = gzipSync(encoder.encode(output), { level: 6 }).byteLength;
    return {
      valid: true as const, mode: "svg-minify" as const, output,
      inputBytes, outputBytes, savedBytes: inputBytes - outputBytes,
      savedPercent: Number((100 * (inputBytes - outputBytes) / inputBytes).toFixed(2)),
      inputGzipBytes, outputGzipBytes, savedGzipBytes: inputGzipBytes - outputGzipBytes,
      donor: "SVGO 4.1.0 (MIT)",
      policy: "Static vector SVG only: comments and metadata removed. Complex, dynamic, embedded-image, linked, scripted or externally referenced SVG refused without output.",
      safety: "NOT_A_GENERAL_SVG_SANITIZER" as const,
      ifLarger: output === source ? "Original retained; no compression benefit." : null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const message = error instanceof Error ? error.message : "Invalid SVG";
    if (message.startsWith("SVG_UNSAFE_CONTENT")) invalid("SVG_UNSAFE_CONTENT", message);
    invalid("INVALID_SVG", "SVGO refused an unsupported or malformed SVG document.");
  }
}
