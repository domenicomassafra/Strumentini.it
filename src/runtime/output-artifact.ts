export const OUTPUT_ARTIFACT_KINDS = ["text", "structured", "image", "pdf", "file"] as const;
export const OUTPUT_ARTIFACT_VERIFICATION_STATES = ["unverified", "verified", "warning", "invalid"] as const;
export const OUTPUT_ARTIFACT_FIDELITY = ["lossless", "lossy", "structural", "unknown"] as const;

export type OutputArtifactKind = (typeof OUTPUT_ARTIFACT_KINDS)[number];
export type OutputArtifactVerificationState = (typeof OUTPUT_ARTIFACT_VERIFICATION_STATES)[number];
export type OutputArtifactFidelity = (typeof OUTPUT_ARTIFACT_FIDELITY)[number];

export interface OutputArtifactVerification {
  readonly state: OutputArtifactVerificationState;
  readonly verifiedMime?: string;
  readonly method?: string;
  readonly signature?: string;
  readonly message?: string;
}

export interface OutputArtifactInput {
  readonly kind: OutputArtifactKind;
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
  readonly verification: OutputArtifactVerification;
  readonly fidelity: OutputArtifactFidelity;
  readonly fidelityNote: string;
}

export interface OutputArtifactDescriptor {
  readonly kind: OutputArtifactKind;
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
  readonly byteLength: number;
  readonly verification: OutputArtifactVerification;
  readonly fidelity: OutputArtifactFidelity;
  readonly fidelityNote: string;
  readonly issues: readonly string[];
  readonly download: {
    readonly filename: string;
    readonly mime: string;
    readonly ready: boolean;
  };
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

function normalizedMime(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").split(";", 1)[0] ?? "";
}

function extensionOf(name: string): string | undefined {
  const last = name.trim().toLocaleLowerCase("en-US").split("/").at(-1) ?? "";
  const index = last.lastIndexOf(".");
  if (index <= 0 || index === last.length - 1) return undefined;
  return last.slice(index + 1);
}

function kindAcceptsMime(kind: OutputArtifactKind, mime: string): boolean {
  if (kind === "file") return mime.length > 0;
  if (kind === "pdf") return mime === "application/pdf";
  if (kind === "image") return mime.startsWith("image/");
  if (kind === "text") return mime.startsWith("text/");
  return mime === "application/json" || mime.startsWith("text/") || mime.endsWith("+json");
}

function validateVerification(verification: OutputArtifactVerification): string[] {
  const issues: string[] = [];
  if (verification.state === "verified") {
    if (verification.verifiedMime === undefined || normalizedMime(verification.verifiedMime) === "") {
      issues.push("Verified artifacts require a verified MIME type.");
    }
    if (verification.method === undefined || verification.method.trim() === "") {
      issues.push("Verified artifacts require the verification method that established the type.");
    }
  }
  if ((verification.state === "warning" || verification.state === "invalid") && (verification.message?.trim() ?? "") === "") {
    issues.push(`${verification.state} verification requires an explanatory message.`);
  }
  return issues;
}

export function createOutputArtifactDescriptor(input: OutputArtifactInput): OutputArtifactDescriptor {
  const name = input.name.trim();
  const mime = normalizedMime(input.mime);
  if (name === "") throw new TypeError("Artifact name is required.");
  if (mime === "") throw new TypeError("Artifact MIME type is required.");
  if (!(input.bytes instanceof Uint8Array)) throw new TypeError("Artifact bytes must be a Uint8Array.");
  if (input.fidelityNote.trim() === "") throw new TypeError("Artifact fidelity note is required.");

  const issues = validateVerification(input.verification);
  const verifiedMime = input.verification.verifiedMime === undefined
    ? undefined
    : normalizedMime(input.verification.verifiedMime);
  if (!kindAcceptsMime(input.kind, mime)) {
    issues.push(`Declared MIME ${mime} does not match artifact kind ${input.kind}.`);
  }
  if (verifiedMime !== undefined && !kindAcceptsMime(input.kind, verifiedMime)) {
    issues.push(`Verified MIME ${verifiedMime} does not match artifact kind ${input.kind}.`);
  }
  if (verifiedMime !== undefined && verifiedMime !== mime) {
    issues.push(`Declared MIME ${mime} does not match verified MIME ${verifiedMime}.`);
  }

  const extension = extensionOf(name);
  const extensionMime = extension === undefined ? undefined : MIME_BY_EXTENSION[extension];
  if (extensionMime !== undefined && extensionMime !== mime) {
    issues.push(`Filename extension .${extension} does not match declared MIME ${mime}.`);
  }
  if (extensionMime !== undefined && verifiedMime !== undefined && extensionMime !== verifiedMime) {
    issues.push(`Filename extension .${extension} does not match verified MIME ${verifiedMime}.`);
  }

  const verification: OutputArtifactVerification = issues.length > 0 && input.verification.state === "verified"
    ? {
        ...input.verification,
        state: "warning",
        message: issues.join(" "),
      }
    : input.verification;
  const ready = verification.state === "verified" && issues.length === 0;

  return {
    kind: input.kind,
    name,
    mime,
    bytes: input.bytes,
    byteLength: input.bytes.byteLength,
    verification,
    fidelity: input.fidelity,
    fidelityNote: input.fidelityNote.trim(),
    issues,
    download: {
      filename: name,
      mime,
      ready,
    },
  };
}
