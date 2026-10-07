import {
  isLocalToolRoute,
  type HandoffDescriptorDeclaration,
  type HandoffToolSummary,
} from "../catalog/manifest";
import type { OutputArtifactDescriptor } from "./output-artifact";

export const BINARY_HANDOFF_TYPES = ["file", "image", "bytes"] as const;
export type BinaryHandoffType = (typeof BINARY_HANDOFF_TYPES)[number];

export const MAX_BINARY_HANDOFF_BYTES = 64 * 1024 * 1024;

export interface BinaryHandoffDescriptor {
  readonly type: BinaryHandoffType;
  readonly version: 1;
  readonly format?: string;
  readonly mime: string;
  readonly name: string;
  readonly bytes: number;
  readonly verification: "verified";
}

export interface BinaryHandoffEnvelope {
  readonly descriptor: BinaryHandoffDescriptor;
  readonly payload: Uint8Array;
}

export type BinaryHandoffProposal =
  | {
      readonly compatible: true;
      readonly target: HandoffToolSummary;
      readonly acceptedBy: HandoffDescriptorDeclaration;
      readonly descriptor: BinaryHandoffDescriptor;
    }
  | {
      readonly compatible: false;
      readonly target: HandoffToolSummary;
      readonly descriptor: BinaryHandoffDescriptor;
      readonly reason: string;
    };

function safeName(value: string): string {
  const last = value.trim().split(/[\\/]/u).at(-1)?.replace(/[\u0000-\u001f\u007f]/gu, "").trim() ?? "";
  if (last === "" || last === "." || last === "..") throw new TypeError("Binary handoff requires a safe file name.");
  return last.slice(0, 255);
}

function normalizedMime(value: string): string {
  const mime = value.trim().toLocaleLowerCase("en-US").split(";", 1)[0] ?? "";
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(mime)) {
    throw new TypeError("Binary handoff requires a valid MIME type.");
  }
  return mime;
}

function normalizedFormat(value: string): string {
  const format = value.trim().toLocaleLowerCase("en-US");
  if (format === "" || !/^[a-z0-9][a-z0-9.+_-]*$/u.test(format)) {
    throw new TypeError("Binary handoff format must be a compact format id.");
  }
  return format;
}

export function createBinaryHandoffEnvelope(
  type: BinaryHandoffType,
  artifact: OutputArtifactDescriptor,
  format?: string,
): BinaryHandoffEnvelope {
  if (!artifact.download.ready || artifact.verification.state !== "verified") {
    throw new Error("Only verified output artifacts can be handed off as binary payloads.");
  }
  if (type === "image" && artifact.kind !== "image") {
    throw new Error("Image handoff requires an image artifact.");
  }
  if (artifact.byteLength > MAX_BINARY_HANDOFF_BYTES) {
    throw new RangeError("Binary handoff exceeds the global ephemeral transfer limit.");
  }
  const payload = new Uint8Array(artifact.bytes);
  return {
    descriptor: {
      type,
      version: 1,
      ...(format === undefined ? {} : { format: normalizedFormat(format) }),
      mime: normalizedMime(artifact.verification.verifiedMime ?? artifact.mime),
      name: safeName(artifact.name),
      bytes: payload.byteLength,
      verification: "verified",
    },
    payload,
  };
}

export function isBinaryHandoffEnvelope(value: unknown): value is BinaryHandoffEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const envelope = value as Partial<BinaryHandoffEnvelope>;
  const descriptor = envelope.descriptor as Partial<BinaryHandoffDescriptor> | undefined;
  if (descriptor === undefined || !(envelope.payload instanceof Uint8Array)) return false;
  if (!BINARY_HANDOFF_TYPES.includes(descriptor.type as BinaryHandoffType)) return false;
  if (descriptor.version !== 1 || descriptor.verification !== "verified") return false;
  if (!Number.isInteger(descriptor.bytes) || (descriptor.bytes ?? -1) < 0 || (descriptor.bytes ?? 0) > MAX_BINARY_HANDOFF_BYTES) return false;
  if (descriptor.bytes !== envelope.payload.byteLength) return false;
  try {
    if (safeName(descriptor.name ?? "") !== descriptor.name) return false;
    if (normalizedMime(descriptor.mime ?? "") !== descriptor.mime) return false;
    if (descriptor.format !== undefined && normalizedFormat(descriptor.format) !== descriptor.format) return false;
  } catch {
    return false;
  }
  return true;
}

function declarationMismatch(
  descriptor: BinaryHandoffDescriptor,
  declaration: HandoffDescriptorDeclaration,
): string | null {
  if (declaration.type !== descriptor.type) return "descriptor type mismatch";
  if (declaration.format !== undefined && declaration.format.toLocaleLowerCase("en-US") !== descriptor.format) {
    return "format mismatch";
  }
  if (declaration.maxBytes !== undefined && descriptor.bytes > declaration.maxBytes) {
    return "payload exceeds " + declaration.maxBytes + " byte handoff limit";
  }
  return null;
}

export function proposeBinaryHandoff(
  envelope: BinaryHandoffEnvelope,
  target: HandoffToolSummary,
): BinaryHandoffProposal {
  const descriptor = envelope.descriptor;
  if (!isBinaryHandoffEnvelope(envelope)) {
    return {
      compatible: false,
      target,
      descriptor,
      reason: "invalid or unsafe binary handoff envelope",
    };
  }
  const accepts = target.handoff?.accepts ?? [];
  if (accepts.length === 0) {
    return {
      compatible: false,
      target,
      descriptor: envelope.descriptor,
      reason: "target declares no compatible handoff input",
    };
  }
  const reasons: string[] = [];
  for (const declaration of accepts) {
    const mismatch = declarationMismatch(envelope.descriptor, declaration);
    if (mismatch === null) {
      return { compatible: true, target, acceptedBy: declaration, descriptor: envelope.descriptor };
    }
    reasons.push(mismatch);
  }
  return {
    compatible: false,
    target,
    descriptor: envelope.descriptor,
    reason: [...new Set(reasons)].join("; "),
  };
}

const MESSAGE_KIND = "strumentini-binary-handoff-v1";

export interface BinaryHandoffMessage {
  readonly kind: typeof MESSAGE_KIND;
  readonly token: string;
  readonly phase: "ready" | "payload";
  readonly envelope?: BinaryHandoffEnvelope;
}

export function validateBinaryHandoffMessage(
  value: unknown,
  expectedToken: string,
  phase: BinaryHandoffMessage["phase"],
): BinaryHandoffMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const message = value as Partial<BinaryHandoffMessage>;
  if (message.kind !== MESSAGE_KIND || message.token !== expectedToken || message.phase !== phase) return null;
  if (phase === "payload" && !isBinaryHandoffEnvelope(message.envelope)) return null;
  return message as BinaryHandoffMessage;
}

export function isTrustedBinaryHandoffEvent(
  event: Pick<MessageEvent, "origin" | "source">,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
): boolean {
  return event.origin === expectedOrigin && event.source === expectedSource && expectedSource !== null;
}

export function openBinaryHandoffTarget(
  proposal: Extract<BinaryHandoffProposal, { compatible: true }>,
  envelope: BinaryHandoffEnvelope,
): boolean {
  if (!isLocalToolRoute(proposal.target.route) || !isBinaryHandoffEnvelope(envelope)) return false;
  const token = crypto.randomUUID();
  const targetWindow = window.open(proposal.target.route + "/#handoff=" + encodeURIComponent(token), "_blank");
  if (targetWindow === null) return false;
  const origin = window.location.origin;
  const timeout = window.setTimeout(() => window.removeEventListener("message", listener), 30_000);
  const listener = (event: MessageEvent) => {
    if (!isTrustedBinaryHandoffEvent(event, origin, targetWindow)) return;
    if (validateBinaryHandoffMessage(event.data, token, "ready") === null) return;
    targetWindow.postMessage({ kind: MESSAGE_KIND, token, phase: "payload", envelope } satisfies BinaryHandoffMessage, origin);
    window.clearTimeout(timeout);
    window.removeEventListener("message", listener);
  };
  window.addEventListener("message", listener);
  return true;
}

export function receiveBinaryHandoffFromOpener(
  target: HandoffToolSummary,
  onReceive: (
    envelope: BinaryHandoffEnvelope,
    proposal: Extract<BinaryHandoffProposal, { compatible: true }>,
  ) => void,
): () => void {
  const match = /^#handoff=([^&]+)$/u.exec(window.location.hash);
  const token = match?.[1] === undefined ? null : decodeURIComponent(match[1]);
  const opener = window.opener;
  if (token === null || opener === null) return () => undefined;
  const origin = window.location.origin;
  const listener = (event: MessageEvent) => {
    if (!isTrustedBinaryHandoffEvent(event, origin, opener)) return;
    const message = validateBinaryHandoffMessage(event.data, token, "payload");
    if (message?.envelope === undefined) return;
    const proposal = proposeBinaryHandoff(message.envelope, target);
    if (!proposal.compatible) return;
    history.replaceState(null, "", window.location.pathname);
    onReceive(message.envelope, proposal);
    window.removeEventListener("message", listener);
  };
  window.addEventListener("message", listener);
  opener.postMessage({ kind: MESSAGE_KIND, token, phase: "ready" } satisfies BinaryHandoffMessage, origin);
  return () => window.removeEventListener("message", listener);
}
