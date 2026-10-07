import {
  createOutputArtifactDescriptor,
  type OutputArtifactDescriptor,
  type OutputArtifactFidelity,
  type OutputArtifactKind,
} from "./output-artifact";

export interface MeasuredArtifactType {
  readonly mime: string | null;
  readonly signature: string | null;
  readonly completeEnough: boolean;
  readonly reason?: string;
}

export interface ArtifactFidelityProof {
  readonly fidelity: OutputArtifactFidelity;
  readonly statement: string;
  readonly limitations?: readonly string[];
}

export interface ArtifactReopenProof {
  readonly ok: boolean;
  readonly method: string;
  readonly facts?: Readonly<Record<string, string | number | boolean>>;
  readonly message?: string;
}

export interface GeneratedArtifactVerificationInput {
  readonly kind: OutputArtifactKind;
  readonly name: string;
  readonly declaredMime: string;
  readonly bytes: Uint8Array;
  readonly fidelity: ArtifactFidelityProof;
  readonly reopen?: (bytes: Uint8Array, measured: MeasuredArtifactType) => ArtifactReopenProof | Promise<ArtifactReopenProof>;
}

export interface GeneratedArtifactVerificationResult {
  readonly artifact: OutputArtifactDescriptor;
  readonly measured: MeasuredArtifactType;
  readonly reopen?: ArtifactReopenProof;
  readonly success: boolean;
  readonly reasons: readonly string[];
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.byteLength < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return new TextDecoder("ascii").decode(bytes.subarray(start, end));
}

export function inspectArtifactSignature(bytes: Uint8Array): MeasuredArtifactType {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return { mime: null, signature: null, completeEnough: false, reason: "Output is empty." };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return bytes.byteLength >= 24
      ? { mime: "image/png", signature: "89504E470D0A1A0A", completeEnough: true }
      : { mime: "image/png", signature: "89504E470D0A1A0A", completeEnough: false, reason: "PNG output is truncated before the IHDR payload can be inspected." };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const hasEoi = bytes.byteLength >= 4 && bytes[bytes.byteLength - 2] === 0xff && bytes[bytes.byteLength - 1] === 0xd9;
    return {
      mime: "image/jpeg",
      signature: "FFD8FF",
      completeEnough: hasEoi,
      ...(hasEoi ? {} : { reason: "JPEG output is missing the terminal EOI marker." }),
    };
  }
  if (bytes.byteLength >= 6 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    const complete = bytes[bytes.byteLength - 1] === 0x3b;
    return {
      mime: "image/gif",
      signature: ascii(bytes, 0, 6),
      completeEnough: complete,
      ...(complete ? {} : { reason: "GIF output is missing the trailer byte." }),
    };
  }
  if (bytes.byteLength >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    const declaredPayload = bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24);
    const expectedBytes = declaredPayload + 8;
    const complete = expectedBytes <= bytes.byteLength;
    return {
      mime: "image/webp",
      signature: "RIFF....WEBP",
      completeEnough: complete,
      ...(complete ? {} : { reason: "WebP RIFF container declares more bytes than are present." }),
    };
  }
  if (bytes.byteLength >= 5 && ascii(bytes, 0, 5) === "%PDF-") {
    const tailStart = Math.max(0, bytes.byteLength - 1024);
    const complete = ascii(bytes, tailStart, bytes.byteLength).includes("%%EOF");
    return {
      mime: "application/pdf",
      signature: "%PDF-",
      completeEnough: complete,
      ...(complete ? {} : { reason: "PDF output is missing an EOF marker." }),
    };
  }
  if (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
    || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])
    || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    const tailStart = Math.max(0, bytes.byteLength - 65_557);
    let hasEocd = false;
    for (let index = bytes.byteLength - 4; index >= tailStart; index -= 1) {
      if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
        hasEocd = true;
        break;
      }
    }
    return {
      mime: "application/zip",
      signature: "PK",
      completeEnough: hasEocd,
      ...(hasEocd ? {} : { reason: "ZIP output is missing the end-of-central-directory record." }),
    };
  }
  if (startsWith(bytes, [0x1f, 0x8b])) {
    return {
      mime: "application/gzip",
      signature: "1F8B",
      completeEnough: bytes.byteLength >= 18,
      ...(bytes.byteLength >= 18 ? {} : { reason: "GZIP output is too short to contain a complete header, body and trailer." }),
    };
  }
  return {
    mime: null,
    signature: null,
    completeEnough: false,
    reason: "No supported binary signature was recognized.",
  };
}

function normalizeMime(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").split(";", 1)[0] ?? "";
}

export async function verifyGeneratedArtifact(
  input: GeneratedArtifactVerificationInput,
): Promise<GeneratedArtifactVerificationResult> {
  const measured = inspectArtifactSignature(input.bytes);
  const declaredMime = normalizeMime(input.declaredMime);
  const reasons: string[] = [];

  if (measured.mime === null) reasons.push(measured.reason ?? "Output type could not be measured.");
  if (!measured.completeEnough) reasons.push(measured.reason ?? "Output container appears incomplete.");
  if (measured.mime !== null && normalizeMime(measured.mime) !== declaredMime) {
    reasons.push(`Declared MIME ${declaredMime} does not match measured MIME ${measured.mime}.`);
  }

  const reopen = input.reopen === undefined ? undefined : await input.reopen(input.bytes, measured);
  if (reopen !== undefined && !reopen.ok) {
    reasons.push(reopen.message?.trim() || `Independent reopen/parse check failed: ${reopen.method}.`);
  }

  const measuredMime = measured.mime ?? declaredMime;
  const verificationClean = reasons.length === 0 && measured.mime !== null && measured.completeEnough && (reopen?.ok ?? true);
  const methodParts = ["signature/container inspection"];
  if (reopen !== undefined) methodParts.push(reopen.method);
  const artifact = createOutputArtifactDescriptor({
    kind: input.kind,
    name: input.name,
    mime: declaredMime,
    bytes: input.bytes,
    verification: verificationClean
      ? {
          state: "verified",
          verifiedMime: measuredMime,
          method: methodParts.join(" + "),
          ...(measured.signature === null ? {} : { signature: measured.signature }),
        }
      : {
          state: "invalid",
          method: methodParts.join(" + "),
          ...(measured.mime === null ? {} : { verifiedMime: measured.mime }),
          ...(measured.signature === null ? {} : { signature: measured.signature }),
          message: reasons.join(" "),
        },
    fidelity: input.fidelity.fidelity,
    fidelityNote: [
      input.fidelity.statement.trim(),
      ...(input.fidelity.limitations ?? []).map((limitation) => "Limitazione: " + limitation.trim()),
    ].filter(Boolean).join(" "),
  });

  return {
    artifact,
    measured,
    ...(reopen === undefined ? {} : { reopen }),
    success: verificationClean && artifact.download.ready,
    reasons,
  };
}
