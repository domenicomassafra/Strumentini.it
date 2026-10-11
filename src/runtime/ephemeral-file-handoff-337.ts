import { createBinaryHandoffEnvelope, isBinaryHandoffEnvelope, isTrustedBinaryHandoffEvent, MAX_BINARY_HANDOFF_BYTES, type BinaryHandoffEnvelope } from "./binary-handoff";
import type { OutputArtifactDescriptor } from "./output-artifact";
import { parseCsvTable } from "../engines/table/csv";

/** An audited narrow adapter, NOT a declaration that other catalog tools accept file handoffs. */
export const PDF_PAGES_HANDOFF_TARGET_337 = {
  id: "pdf-to-images",
  route: "/tools/pdf-to-images",
  mime: "application/pdf",
  format: "pdf",
} as const;

export const PNG_COMPRESSION_HANDOFF_TARGET_337 = {
  id: "image-compression",
  route: "/tools/image-compression",
  mime: "image/png",
  format: "png",
} as const;
/** The CSV destination declares 10 MiB; do not widen the old 2 MiB table-string transport. */
export const CSV_EXPORT_HANDOFF_MAX_BYTES_337 = 10 * 1024 * 1024;
export const CSV_EXPORT_HANDOFF_TARGET_337 = {
  id: "csv-dedupe",
  route: "/tools/csv-dedupe",
  mime: "text/csv",
  format: "csv",
} as const;
type HandoffTarget337 = typeof PDF_PAGES_HANDOFF_TARGET_337 | typeof PNG_COMPRESSION_HANDOFF_TARGET_337 | typeof CSV_EXPORT_HANDOFF_TARGET_337;

export const EPHEMERAL_FILE_HANDOFF_TTL_MS_337 = 30_000;
const MESSAGE_KIND = "strumentini-ephemeral-file-handoff-337";
const TOKEN_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;

export type EphemeralHandoffStatus337 = "received" | "expired" | "cancelled" | "unavailable";
export type EphemeralHandoffStart337 =
  | { readonly opened: true; readonly cancel: () => void }
  | { readonly opened: false; readonly reason: string };

export interface EphemeralHandoffEnvironment337 {
  readonly window: Window;
  readonly now?: () => number;
  readonly createToken?: () => string;
}

function nowMs(environment: EphemeralHandoffEnvironment337) {
  return environment.now?.() ?? Date.now();
}

function isPdfPayload(envelope: BinaryHandoffEnvelope): boolean {
  if (!isBinaryHandoffEnvelope(envelope)) return false;
  const { descriptor, payload } = envelope;
  return descriptor.type === "file" && descriptor.format === "pdf"
    && descriptor.mime === "application/pdf"
    && descriptor.bytes > 0 && descriptor.bytes <= MAX_BINARY_HANDOFF_BYTES
    && /\.pdf$/iu.test(descriptor.name)
    && payload.byteLength >= 12
    && payload[0] === 0x25 && payload[1] === 0x50 && payload[2] === 0x44 && payload[3] === 0x46 && payload[4] === 0x2d;
}

function isPngBytes(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return bytes.byteLength >= 45
    && signature.every((value, index) => bytes[index] === value)
    && bytes[8] === 0 && bytes[9] === 0 && bytes[10] === 0 && bytes[11] === 13
    && bytes[12] === 73 && bytes[13] === 72 && bytes[14] === 68 && bytes[15] === 82
    && bytes[16] !== undefined && bytes[20] !== undefined
    && bytes.subarray(16, 20).some((value) => value !== 0)
    && bytes.subarray(20, 24).some((value) => value !== 0)
    && bytes.slice(-12).every((value, index) => value === [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130][index]);
}

function isPngPayload(envelope: BinaryHandoffEnvelope): boolean {
  if (!isBinaryHandoffEnvelope(envelope)) return false;
  const { descriptor, payload } = envelope;
  return descriptor.type === "image" && descriptor.format === "png"
    && descriptor.mime === "image/png"
    && descriptor.bytes > 0 && descriptor.bytes <= MAX_BINARY_HANDOFF_BYTES
    && /\.png$/iu.test(descriptor.name) && isPngBytes(payload);
}

function isCsvBytes337(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0 || bytes.byteLength > CSV_EXPORT_HANDOFF_MAX_BYTES_337 || bytes.includes(0)) return false;
  try {
    const table = parseCsvTable(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return table.header.length > 0;
  } catch { return false; }
}

function isCsvPayload(envelope: BinaryHandoffEnvelope): boolean {
  if (!isBinaryHandoffEnvelope(envelope)) return false;
  const { descriptor, payload } = envelope;
  return descriptor.type === "file" && descriptor.format === "csv"
    && descriptor.mime === "text/csv" && /\.csv$/iu.test(descriptor.name)
    && descriptor.bytes <= CSV_EXPORT_HANDOFF_MAX_BYTES_337 && isCsvBytes337(payload);
}

export function canOfferCsvExportHandoff337(artifact: OutputArtifactDescriptor | null | undefined): artifact is OutputArtifactDescriptor {
  return artifact !== null && artifact !== undefined && artifact.kind === "structured"
    && artifact.download.ready && artifact.verification.state === "verified"
    && artifact.mime === "text/csv" && artifact.verification.verifiedMime === "text/csv"
    && /\.csv$/iu.test(artifact.name) && artifact.bytes instanceof Uint8Array
    && artifact.byteLength === artifact.bytes.byteLength && isCsvBytes337(artifact.bytes);
}

/** Only locally verified PNG output is eligible for the explicit PNG→compress action. */
export function canOfferPngCompressionHandoff337(artifact: OutputArtifactDescriptor | null | undefined): artifact is OutputArtifactDescriptor {
  return artifact !== undefined && artifact !== null
    && artifact.kind === "image" && artifact.download.ready
    && artifact.verification.state === "verified"
    && artifact.verification.verifiedMime === PNG_COMPRESSION_HANDOFF_TARGET_337.mime
    && artifact.mime === PNG_COMPRESSION_HANDOFF_TARGET_337.mime
    && artifact.bytes instanceof Uint8Array && artifact.bytes.byteLength === artifact.byteLength
    && artifact.byteLength > 0 && artifact.byteLength <= MAX_BINARY_HANDOFF_BYTES
    && /\.png$/iu.test(artifact.name) && isPngBytes(artifact.bytes);
}

/** A source PDF must be already verified by the local PDF result pipeline. */
export function canOfferPdfPagesHandoff337(artifact: OutputArtifactDescriptor | null | undefined): artifact is OutputArtifactDescriptor {
  return artifact !== undefined && artifact !== null
    && artifact.kind === "pdf"
    && artifact.download.ready && artifact.verification.state === "verified"
    && artifact.verification.verifiedMime === PDF_PAGES_HANDOFF_TARGET_337.mime
    && artifact.mime === PDF_PAGES_HANDOFF_TARGET_337.mime
    && artifact.bytes instanceof Uint8Array
    && artifact.bytes.byteLength === artifact.byteLength
    && artifact.byteLength > 0 && artifact.byteLength <= MAX_BINARY_HANDOFF_BYTES
    && /\.pdf$/iu.test(artifact.name)
    && artifact.bytes.length >= 12
    && artifact.bytes[0] === 0x25 && artifact.bytes[1] === 0x50 && artifact.bytes[2] === 0x44
    && artifact.bytes[3] === 0x46 && artifact.bytes[4] === 0x2d;
}

type ProtocolMessage = {
  readonly kind: typeof MESSAGE_KIND;
  readonly token: string;
  readonly phase: "ready" | "payload" | "received" | "rejected";
  readonly targetId: HandoffTarget337["id"];
  readonly expiresAt?: number;
  readonly envelope?: BinaryHandoffEnvelope;
};

function isProtocolMessage(input: unknown, token: string, phase: ProtocolMessage["phase"], target: HandoffTarget337): input is ProtocolMessage {
  if (typeof input !== "object" || input === null) return false;
  const value = input as Partial<ProtocolMessage>;
  return value.kind === MESSAGE_KIND && value.token === token && value.phase === phase
    && value.targetId === target.id;
}

function tokenFromHash(hash: string): string | null {
  const match = /^#handoff337=([^&]+)$/u.exec(hash);
  if (match?.[1] === undefined) return null;
  // The token is a URL-fragment-only capability; do not decode arbitrary inputs.
  return TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}

/**
 * Call synchronously from an explicit user click (popup blockers). Nothing is
 * stored, downloaded or uploaded. Sender drops its in-memory payload on ack,
 * cancel or expiry. A new click is required to retry after uncertainty.
 */
export function startPdfPagesHandoff337(
  artifact: OutputArtifactDescriptor,
  onStatus?: (status: EphemeralHandoffStatus337) => void,
  environment: EphemeralHandoffEnvironment337 = { window },
): EphemeralHandoffStart337 {
  return startFileHandoff337(artifact, PDF_PAGES_HANDOFF_TARGET_337, canOfferPdfPagesHandoff337, "Solo un PDF verificato entro 64 MiB può essere trasferito.", onStatus, environment);
}

export function startPngCompressionHandoff337(
  artifact: OutputArtifactDescriptor,
  onStatus?: (status: EphemeralHandoffStatus337) => void,
  environment: EphemeralHandoffEnvironment337 = { window },
): EphemeralHandoffStart337 {
  return startFileHandoff337(artifact, PNG_COMPRESSION_HANDOFF_TARGET_337, canOfferPngCompressionHandoff337, "Solo un PNG verificato entro 64 MiB può essere trasferito.", onStatus, environment);
}

export function startCsvExportHandoff337(
  artifact: OutputArtifactDescriptor,
  onStatus?: (status: EphemeralHandoffStatus337) => void,
  environment: EphemeralHandoffEnvironment337 = { window },
): EphemeralHandoffStart337 {
  return startFileHandoff337(artifact, CSV_EXPORT_HANDOFF_TARGET_337, canOfferCsvExportHandoff337,
    "Solo un CSV UTF-8 verificato, valido e fino a 10 MiB può essere trasferito.", onStatus, environment);
}

function startFileHandoff337(
  artifact: OutputArtifactDescriptor,
  target: HandoffTarget337,
  accepts: (artifact: OutputArtifactDescriptor) => boolean,
  rejection: string,
  onStatus: ((status: EphemeralHandoffStatus337) => void) | undefined,
  environment: EphemeralHandoffEnvironment337,
): EphemeralHandoffStart337 {
  if (!accepts(artifact)) return { opened: false, reason: rejection };
  const token = environment.createToken?.() ?? crypto.randomUUID();
  if (!TOKEN_PATTERN.test(token)) return { opened: false, reason: "Impossibile creare una chiave temporanea sicura." };
  const sender = environment.window;
  const expiresAt = nowMs(environment) + EPHEMERAL_FILE_HANDOFF_TTL_MS_337;
  let envelope: BinaryHandoffEnvelope | null;
  try { envelope = createBinaryHandoffEnvelope(target.id === "image-compression" ? "image" : "file", artifact, target.format); }
  catch { return { opened: false, reason: "Impossibile verificare il file da trasferire." }; }
  const receiver = sender.open(`${target.route}/#handoff337=${token}`, "_blank");
  if (receiver === null) return { opened: false, reason: "Il browser ha bloccato la nuova scheda." };
  const origin = sender.location.origin;
  let active = true;
  let sent = false;
  let timer: number | undefined;
  const cleanup = (status: EphemeralHandoffStatus337) => {
    if (!active) return;
    active = false;
    envelope = null;
    sender.removeEventListener("message", onMessage);
    if (timer !== undefined) sender.clearTimeout(timer);
    onStatus?.(status);
  };
  const onMessage = (event: MessageEvent) => {
    if (!active || !isTrustedBinaryHandoffEvent(event, origin, receiver)) return;
    // A trusted refusal releases the pending bytes even if the payload's TTL just elapsed.
    if (sent && isProtocolMessage(event.data, token, "rejected", target)) { cleanup("unavailable"); return; }
    if (nowMs(environment) >= expiresAt) { cleanup("expired"); return; }
    if (!sent && isProtocolMessage(event.data, token, "ready", target)) {
      if (envelope === null) return;
      sent = true;
      receiver.postMessage({ kind: MESSAGE_KIND, token, phase: "payload", targetId: target.id,
        expiresAt, envelope } satisfies ProtocolMessage, origin);
    } else if (sent && isProtocolMessage(event.data, token, "received", target)) {
      cleanup("received");
    }
  };
  sender.addEventListener("message", onMessage);
  timer = sender.setTimeout(() => cleanup("expired"), EPHEMERAL_FILE_HANDOFF_TTL_MS_337);
  return { opened: true, cancel: () => cleanup("cancelled") };
}

/**
 * Receives exactly once from the opening same-origin Window. The resulting
 * native File is fed straight to the existing PdfTool `files` state, without
 * showing a file chooser or invoking any provider. Requires the consumer's
 * parser to perform its normal input validation before transformation.
 */
export function receivePdfPagesHandoff337(
  onReceive: (file: File) => unknown,
  environment: EphemeralHandoffEnvironment337 = { window },
): () => void {
  return receiveFileHandoff337(onReceive, PDF_PAGES_HANDOFF_TARGET_337, isPdfPayload, environment);
}

export function receivePngCompressionHandoff337(
  onReceive: (file: File) => unknown,
  environment: EphemeralHandoffEnvironment337 = { window },
  onFailure?: (reason: "expired" | "invalid" | "unavailable") => void,
): () => void {
  return receiveFileHandoff337(onReceive, PNG_COMPRESSION_HANDOFF_TARGET_337, isPngPayload, environment, onFailure);
}

export function receiveCsvExportHandoff337(
  onReceive: (file: File) => unknown,
  environment: EphemeralHandoffEnvironment337 = { window },
  onFailure?: (reason: "expired" | "invalid" | "unavailable") => void,
): () => void {
  return receiveFileHandoff337(onReceive, CSV_EXPORT_HANDOFF_TARGET_337, isCsvPayload, environment, onFailure);
}

function receiveFileHandoff337(
  onReceive: (file: File) => unknown,
  target: HandoffTarget337,
  accepts: (envelope: BinaryHandoffEnvelope) => boolean,
  environment: EphemeralHandoffEnvironment337,
  onFailure?: (reason: "expired" | "invalid" | "unavailable") => void,
): () => void {
  const receiver = environment.window;
  const token = tokenFromHash(receiver.location.hash);
  const opener = receiver.opener;
  if (token === null || opener === null) {
    if (token !== null) {
      // No opener means no authorized consumer of this URL capability.
      receiver.history.replaceState(null, "", receiver.location.pathname + receiver.location.search);
      onFailure?.("unavailable");
    }
    return () => undefined;
  }
  const origin = receiver.location.origin;
  const startedAt = nowMs(environment);
  let consumed = false;
  let timer: number | undefined;
  const cleanup = () => {
    receiver.removeEventListener("message", onMessage);
    if (timer !== undefined) receiver.clearTimeout(timer);
  };
  const discardFragment = () => {
    if (receiver.location.hash === `#handoff337=${token}`) {
      receiver.history.replaceState(null, "", receiver.location.pathname + receiver.location.search);
    }
  };
  const onMessage = (event: MessageEvent) => {
    if (consumed || !isTrustedBinaryHandoffEvent(event, origin, opener)) return;
    if (!isProtocolMessage(event.data, token, "payload", target)) return;
    const expired = nowMs(environment) - startedAt >= EPHEMERAL_FILE_HANDOFF_TTL_MS_337 ||
      Number.isSafeInteger(event.data.expiresAt) && event.data.expiresAt! <= nowMs(environment);
    let validPayload = false;
    // The opener's message may contain arbitrary structured-clone shapes.
    try { validPayload = event.data.envelope !== undefined && accepts(event.data.envelope); }
    catch { validPayload = false; }
    if (expired || !Number.isSafeInteger(event.data.expiresAt)
      || event.data.expiresAt! > nowMs(environment) + EPHEMERAL_FILE_HANDOFF_TTL_MS_337
      || !validPayload) {
      consumed = true;
      cleanup();
      discardFragment();
      opener.postMessage({ kind: MESSAGE_KIND, phase: "rejected", token,
        targetId: target.id } satisfies ProtocolMessage, origin);
      onFailure?.(expired ? "expired" : "invalid");
      return;
    }
    consumed = true;
    cleanup();
    discardFragment();
    const reject = () => {
      opener.postMessage({ kind: MESSAGE_KIND, phase: "rejected", token,
        targetId: target.id } satisfies ProtocolMessage, origin);
      onFailure?.("unavailable");
    };
    try {
      if (event.data.envelope === undefined) { reject(); return; }
      const { descriptor, payload } = event.data.envelope;
      // A fresh native File is the exact input type expected by the PDF engine.
      const file = new File([new Uint8Array(payload)], descriptor.name, { type: target.mime });
      // Only synchronous, accepted local state updates may receive an ACK.
      const accepted = onReceive(file);
      if (accepted === false || accepted instanceof Promise) { reject(); return; }
      opener.postMessage({ kind: MESSAGE_KIND, phase: "received", token,
        targetId: target.id } satisfies ProtocolMessage, origin);
    } catch {
      // Consumer rejected the file: never claim a successful handoff.
      reject();
    }
  };
  receiver.addEventListener("message", onMessage);
  timer = receiver.setTimeout(() => { consumed = true; cleanup(); discardFragment(); onFailure?.("expired"); }, EPHEMERAL_FILE_HANDOFF_TTL_MS_337);
  opener.postMessage({ kind: MESSAGE_KIND, phase: "ready", token,
    targetId: target.id } satisfies ProtocolMessage, origin);
  return () => { consumed = true; cleanup(); };
}
