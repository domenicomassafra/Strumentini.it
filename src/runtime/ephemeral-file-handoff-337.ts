import { createBinaryHandoffEnvelope, isBinaryHandoffEnvelope, isTrustedBinaryHandoffEvent, MAX_BINARY_HANDOFF_BYTES, type BinaryHandoffEnvelope } from "./binary-handoff";
import type { OutputArtifactDescriptor } from "./output-artifact";

/** An audited narrow adapter, NOT a declaration that other catalog tools accept file handoffs. */
export const PDF_PAGES_HANDOFF_TARGET_337 = {
  id: "pdf-to-images",
  route: "/tools/pdf-to-images",
  mime: "application/pdf",
  format: "pdf",
} as const;

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
  const { descriptor, payload } = envelope;
  return isBinaryHandoffEnvelope(envelope)
    && descriptor.type === "file" && descriptor.format === "pdf"
    && descriptor.mime === "application/pdf"
    && descriptor.bytes > 0 && descriptor.bytes <= MAX_BINARY_HANDOFF_BYTES
    && /\.pdf$/iu.test(descriptor.name)
    && payload.byteLength >= 12
    && payload[0] === 0x25 && payload[1] === 0x50 && payload[2] === 0x44 && payload[3] === 0x46 && payload[4] === 0x2d;
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
  readonly phase: "ready" | "payload" | "received";
  readonly targetId: typeof PDF_PAGES_HANDOFF_TARGET_337.id;
  readonly expiresAt?: number;
  readonly envelope?: BinaryHandoffEnvelope;
};

function isProtocolMessage(input: unknown, token: string, phase: ProtocolMessage["phase"]): input is ProtocolMessage {
  if (typeof input !== "object" || input === null) return false;
  const value = input as Partial<ProtocolMessage>;
  return value.kind === MESSAGE_KIND && value.token === token && value.phase === phase
    && value.targetId === PDF_PAGES_HANDOFF_TARGET_337.id;
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
  if (!canOfferPdfPagesHandoff337(artifact)) return { opened: false, reason: "Solo un PDF verificato entro 64 MiB può essere trasferito." };
  const token = environment.createToken?.() ?? crypto.randomUUID();
  if (!TOKEN_PATTERN.test(token)) return { opened: false, reason: "Impossibile creare una chiave temporanea sicura." };
  const sender = environment.window;
  const expiresAt = nowMs(environment) + EPHEMERAL_FILE_HANDOFF_TTL_MS_337;
  let envelope: BinaryHandoffEnvelope | null;
  try { envelope = createBinaryHandoffEnvelope("file", artifact, "pdf"); }
  catch { return { opened: false, reason: "Impossibile verificare il file da trasferire." }; }
  const receiver = sender.open(`${PDF_PAGES_HANDOFF_TARGET_337.route}/#handoff337=${token}`, "_blank");
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
    if (nowMs(environment) >= expiresAt) { cleanup("expired"); return; }
    if (!sent && isProtocolMessage(event.data, token, "ready")) {
      if (envelope === null) return;
      sent = true;
      receiver.postMessage({ kind: MESSAGE_KIND, token, phase: "payload", targetId: PDF_PAGES_HANDOFF_TARGET_337.id,
        expiresAt, envelope } satisfies ProtocolMessage, origin);
    } else if (sent && isProtocolMessage(event.data, token, "received")) {
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
  onReceive: (file: File) => void,
  environment: EphemeralHandoffEnvironment337 = { window },
): () => void {
  const receiver = environment.window;
  const token = tokenFromHash(receiver.location.hash);
  const opener = receiver.opener;
  if (token === null || opener === null) return () => undefined;
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
    if (!isProtocolMessage(event.data, token, "payload")) return;
    if (nowMs(environment) - startedAt >= EPHEMERAL_FILE_HANDOFF_TTL_MS_337 ||
      !Number.isSafeInteger(event.data.expiresAt) || event.data.expiresAt! <= nowMs(environment)
      || event.data.expiresAt! > nowMs(environment) + EPHEMERAL_FILE_HANDOFF_TTL_MS_337
      || event.data.envelope === undefined || !isPdfPayload(event.data.envelope)) return;
    consumed = true;
    cleanup();
    discardFragment();
    try {
      const { descriptor, payload } = event.data.envelope;
      // A fresh native File is the exact input type expected by the PDF engine.
      const file = new File([new Uint8Array(payload)], descriptor.name, { type: PDF_PAGES_HANDOFF_TARGET_337.mime });
      onReceive(file);
      opener.postMessage({ kind: MESSAGE_KIND, phase: "received", token,
        targetId: PDF_PAGES_HANDOFF_TARGET_337.id } satisfies ProtocolMessage, origin);
    } catch {
      // Fail closed: no acknowledgement of a failed consumer operation.
    }
  };
  receiver.addEventListener("message", onMessage);
  timer = receiver.setTimeout(() => { consumed = true; cleanup(); discardFragment(); }, EPHEMERAL_FILE_HANDOFF_TTL_MS_337);
  opener.postMessage({ kind: MESSAGE_KIND, phase: "ready", token,
    targetId: PDF_PAGES_HANDOFF_TARGET_337.id } satisfies ProtocolMessage, origin);
  return () => { consumed = true; cleanup(); };
}
