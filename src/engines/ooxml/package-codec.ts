import {
  OOXML_PACKAGE_LIMITS,
  OoxmlPackageError,
  analyzeOoxmlPackage,
  type OoxmlPackageAnalysis,
} from "./package";
import type { Zippable } from "fflate";

export interface OoxmlRebuildResult {
  readonly bytes: ArrayBuffer;
  readonly byteLength: number;
  readonly inputByteLength: number;
  readonly savedBytes: number;
  readonly sizeOutcome: "smaller" | "same" | "larger";
  readonly input: OoxmlPackageAnalysis;
  readonly output: OoxmlPackageAnalysis;
  readonly verification: {
    readonly memberSetUnchanged: true;
    readonly memberBytesUnchanged: true;
    readonly relationshipBytesUnchanged: true;
    readonly contentTypesBytesUnchanged: true;
    readonly structuralCountsUnchanged: true;
    readonly outputCompression: "deflate";
    readonly externalRelationshipsPreservedInert: number;
  };
}

function fail(message: string): never {
  throw new OoxmlPackageError("REBUILD_VERIFICATION_FAILED", message);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function sortedKeys(value: Readonly<Record<string, Uint8Array>>): string[] {
  return Object.keys(value).toSorted((left, right) => left.localeCompare(right));
}

function sameKeys(left: Readonly<Record<string, Uint8Array>>, right: Readonly<Record<string, Uint8Array>>): boolean {
  const a = sortedKeys(left);
  const b = sortedKeys(right);
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function externalRelationshipCount(members: Readonly<Record<string, Uint8Array>>): number {
  const decoder = new TextDecoder();
  let count = 0;
  for (const [path, bytes] of Object.entries(members)) {
    if (!/\.rels$/u.test(path)) continue;
    const xml = decoder.decode(bytes);
    count += xml.match(/\bTargetMode\s*=\s*["']External["']/giu)?.length ?? 0;
  }
  return count;
}

function structuralCountsEqual(left: OoxmlPackageAnalysis, right: OoxmlPackageAnalysis): boolean {
  return left.kind === right.kind &&
    left.entryCount === right.entryCount &&
    left.documentCount === right.documentCount &&
    left.slideCount === right.slideCount &&
    left.sheetCount === right.sheetCount &&
    left.relationshipPartCount === right.relationshipPartCount;
}

export async function rebuildOoxmlPackage(input: ArrayBuffer | Uint8Array): Promise<OoxmlRebuildResult> {
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const inputAnalysis = analyzeOoxmlPackage(source);
  const { unzipSync, zipSync } = await import("fflate");
  let members: Record<string, Uint8Array>;
  try {
    members = unzipSync(source);
  } catch (error) {
    fail(error instanceof Error ? `DEFLATE decode failed after bounded preflight: ${error.message}` : "DEFLATE decode failed after bounded preflight.");
  }
  const declared = new Map(inputAnalysis.entries.map((entry) => [entry.path, entry] as const));
  if (members === undefined || Object.keys(members).length !== inputAnalysis.entryCount) fail("Decoded member set does not match the central directory.");
  for (const [path, bytes] of Object.entries(members)) {
    const entry = declared.get(path);
    if (entry === undefined) fail(`Decoded member was not declared by the central directory: ${path}.`);
    if (bytes.byteLength !== entry.uncompressedSize) fail(`${path}: decoded byte length differs from the bounded central-directory value.`);
  }
  const externalRelationships = externalRelationshipCount(members);
  const zippable: Zippable = {};
  for (const [path, bytes] of Object.entries(members)) zippable[path] = [bytes, { level: 9 }];
  let rebuilt: Uint8Array;
  try {
    rebuilt = zipSync(zippable, { level: 9 });
  } catch (error) {
    fail(error instanceof Error ? `DEFLATE rebuild failed: ${error.message}` : "DEFLATE rebuild failed.");
  }
  if (rebuilt.byteLength > OOXML_PACKAGE_LIMITS.maxInputBytes) throw new OoxmlPackageError("OUTPUT_TOO_LARGE", "Rebuilt OOXML package exceeds the bounded output limit.");
  const outputAnalysis = analyzeOoxmlPackage(rebuilt);
  if (!outputAnalysis.entries.every(({ compressionMethod }) => compressionMethod === 8)) fail("Rebuilt OOXML package contains a non-DEFLATE member.");
  let reopened: Record<string, Uint8Array>;
  try {
    reopened = unzipSync(rebuilt);
  } catch (error) {
    fail(error instanceof Error ? `Rebuilt package could not be reopened: ${error.message}` : "Rebuilt package could not be reopened.");
  }
  if (!sameKeys(members, reopened)) fail("Rebuilt package changed the member set.");
  for (const path of Object.keys(members)) {
    const before = members[path];
    const after = reopened[path];
    if (before === undefined || after === undefined || !equalBytes(before, after)) fail(`Rebuilt package changed member bytes: ${path}.`);
  }
  const relationshipsUnchanged = Object.keys(members).filter((path) => /\.rels$/u.test(path)).every((path) => equalBytes(members[path]!, reopened[path]!));
  if (!relationshipsUnchanged) fail("Rebuilt package changed relationship-part bytes.");
  const beforeContentTypes = members["[Content_Types].xml"];
  const afterContentTypes = reopened["[Content_Types].xml"];
  if (beforeContentTypes === undefined || afterContentTypes === undefined || !equalBytes(beforeContentTypes, afterContentTypes)) fail("Rebuilt package changed [Content_Types].xml bytes.");
  if (!structuralCountsEqual(inputAnalysis, outputAnalysis)) fail("Rebuilt package changed document/slide/sheet or relationship counts.");
  const savedBytes = source.byteLength - rebuilt.byteLength;
  const bytes = rebuilt.slice().buffer;
  return {
    bytes,
    byteLength: rebuilt.byteLength,
    inputByteLength: source.byteLength,
    savedBytes,
    sizeOutcome: savedBytes > 0 ? "smaller" : savedBytes < 0 ? "larger" : "same",
    input: inputAnalysis,
    output: outputAnalysis,
    verification: {
      memberSetUnchanged: true,
      memberBytesUnchanged: true,
      relationshipBytesUnchanged: true,
      contentTypesBytesUnchanged: true,
      structuralCountsUnchanged: true,
      outputCompression: "deflate",
      externalRelationshipsPreservedInert: externalRelationships,
    },
  };
}
