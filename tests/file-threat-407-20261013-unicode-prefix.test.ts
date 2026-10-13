/** #407: independent namespace parse of real ZIP members; no rendering/fetch. */
import { createRequire } from "node:module";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { detectLocalFile, FILE_DETECTION_LIMITS, type LocalFileSource } from "../src/runtime/file-detection";
import { FILE_THREAT_LIMITS_407 } from "../src/runtime/file-threat-gate-407";

// Reuse the root-lock-pinned SAX oracle already used by #407 wave22.
const { parser: saxParser } = createRequire(import.meta.url)("sax") as {
  parser: (strict: boolean, options: { xmlns: true }) => {
    onopentag: (node: { local: string; uri: string }) => void;
    write: (source: string) => { close: () => void };
  };
};
const svgNamespace = "http://www.w3.org/2000/svg";

function zipFile(xml: string, name = "graphics/document.xml", level: 0 | 6 = 6): File {
  const bytes = zipSync({ [name]: strToU8(xml) }, { level });
  const extracted = unzipSync(bytes)[name];
  expect(new TextDecoder("utf-8", { fatal: true }).decode(extracted)).toBe(xml);
  return new File([new Uint8Array(bytes)], "unicode-svg.zip", { type: "application/zip" });
}

function parsedElements(xml: string) {
  const elements: { local: string; uri: string }[] = [];
  const parser = saxParser(true, { xmlns: true });
  parser.onopentag = ({ local, uri }) => elements.push({ local, uri });
  expect(() => parser.write(xml).close()).not.toThrow();
  return elements;
}

function boundedFile(real: File, onSlice?: () => void) {
  let readBytes = 0;
  const source: LocalFileSource = {
    name: real.name, type: real.type, size: real.size,
    slice(start = 0, end = real.size) {
      expect(end - start).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      readBytes += end - start;
      expect(readBytes).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      onSlice?.();
      return real.slice(start, end);
    },
  };
  return { source, readBytes: () => readBytes };
}

describe("#407 Unicode XML namespace aliases cannot hide active SVG members", () => {
  it.each([
    ["accented prefix", "é", "script"],
    ["CJK prefix", "中", "foreignObject"],
    ["combining mark in prefix", "s\u0301", "script"],
    ["XML name character treated as JS whitespace", "s\ufeff", "script"],
    ["Unicode SVG root under .xml", "é", "animateTransform"],
  ])("refuses %s after an independent namespace-aware parse", async (_name, prefix, active) => {
    const payload = active === "script" ? "globalThis.__hostile407 = 1" : "";
    const xml = `<${prefix}:svg xmlns:${prefix}="${svgNamespace}"><${prefix}:${active}>${payload}</${prefix}:${active}></${prefix}:svg>`;
    expect(parsedElements(xml)).toEqual([
      { local: "svg", uri: svgNamespace }, { local: active, uri: svgNamespace },
    ]);
    const tracked = boundedFile(zipFile(xml));
    expect(await detectLocalFile(tracked.source)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("keeps independently valid inert Unicode-prefixed shapes as candidates", async () => {
    const xml = `<é:svg xmlns:é="${svgNamespace}"><é:path d="M0 0 L20 20"/></é:svg>`;
    expect(parsedElements(xml)).toEqual([
      { local: "svg", uri: svgNamespace }, { local: "path", uri: svgNamespace },
    ]);
    expect(await detectLocalFile(zipFile(xml))).toMatchObject({
      status: "supported", format: "zip", note: "candidate only; decoding and content safety are not verified",
    });
  });

  it("applies the existing encoded-namespace refusal to Unicode aliases too", async () => {
    const xml = '<é:svg xmlns:é="http://www.w3.org/2000/sv&#x67;"><é:path d="M0 0"/></é:svg>';
    expect(parsedElements(xml)).toEqual([
      { local: "svg", uri: svgNamespace }, { local: "path", uri: svgNamespace },
    ]);
    expect(await detectLocalFile(zipFile(xml))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("refuses a long valid Unicode alias within the bounded text budget", async () => {
    const prefix = "é".repeat(4096);
    const xml = `<svg xmlns="${svgNamespace}" xmlns:${prefix}="${svgNamespace}"><${prefix}:script>globalThis.__hostile407 = 1</${prefix}:script></svg>`;
    expect(strToU8(xml).length).toBeLessThan(FILE_THREAT_LIMITS_407.maxTextPartBytes);
    expect(parsedElements(xml)).toContainEqual({ local: "script", uri: svgNamespace });
    const tracked = boundedFile(zipFile(xml, "graphics/long.svg", 0));
    expect(await detectLocalFile(tracked.source)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  }, 2000);

  it("refuses text larger than the existing allocation budget", async () => {
    const xml = `<é:svg xmlns:é="${svgNamespace}">${" ".repeat(FILE_THREAT_LIMITS_407.maxTextPartBytes)}</é:svg>`;
    const tracked = boundedFile(zipFile(xml, "graphics/large.xml", 0));
    expect(await detectLocalFile(tracked.source)).toMatchObject({ status: "refused", reason: "TOO_LARGE" });
    expect(tracked.readBytes()).toBeLessThan(strToU8(xml).length);
  });

  it("preserves cancellation before reads and during a real bounded read", async () => {
    const xml = `<é:svg xmlns:é="${svgNamespace}"><é:script/></é:svg>`;
    const real = zipFile(xml);
    const cancelled = new AbortController();
    cancelled.abort();
    const before = boundedFile(real);
    expect(await detectLocalFile(before.source, { signal: cancelled.signal })).toMatchObject({
      status: "refused", reason: "CANCELLED", readBytes: 0,
    });
    expect(before.readBytes()).toBe(0);
    const during = new AbortController();
    const reading = boundedFile(real, () => during.abort());
    expect(await detectLocalFile(reading.source, { signal: during.signal })).toMatchObject({
      status: "refused", reason: "CANCELLED",
    });
    expect(reading.readBytes()).toBe(64);
  });
});
