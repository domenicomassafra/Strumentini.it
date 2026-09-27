import { isLocalToolRoute, type HandoffDescriptorDeclaration, type ToolSummary } from "../catalog/manifest";
import { getTelemetryAdapter } from "../telemetry/browser";
import { trackHandoffUsed } from "../telemetry/events";
import type { TelemetryAdapter } from "../telemetry/adapter";

export interface TableHandoffDescriptor {
  type: "table";
  format: "csv";
  version: 1;
  encoding: "utf-8";
  bytes: number;
  rowCount: number;
  columnCount: number;
  columns: readonly string[];
  duplicateHeaders: boolean;
  raggedRows: boolean;
}

export interface TableHandoffEnvelope {
  descriptor: TableHandoffDescriptor;
  payload: string;
}

export type HandoffProposal =
  | {
      compatible: true;
      target: ToolSummary;
      acceptedBy: HandoffDescriptorDeclaration;
      descriptor: TableHandoffDescriptor;
      preview: string;
      lossy: false;
    }
  | {
      compatible: false;
      target: ToolSummary;
      descriptor: TableHandoffDescriptor;
      reason: string;
    };

function compatibleDeclaration(
  descriptor: TableHandoffDescriptor,
  declaration: HandoffDescriptorDeclaration,
): string | null {
  if (declaration.type !== descriptor.type) return "descriptor type mismatch";
  if (declaration.format !== undefined && declaration.format !== descriptor.format) return "format mismatch";
  if (declaration.maxBytes !== undefined && descriptor.bytes > declaration.maxBytes) {
    return `payload exceeds ${declaration.maxBytes} byte handoff limit`;
  }
  if (declaration.requiresUniqueHeaders === true && descriptor.duplicateHeaders) {
    return "target requires unique column headers";
  }
  if (declaration.acceptsRaggedRows === false && descriptor.raggedRows) {
    return "target requires rectangular rows";
  }
  return null;
}

export function proposeHandoff(envelope: TableHandoffEnvelope, target: ToolSummary): HandoffProposal {
  const accepts = target.handoff?.accepts ?? [];
  if (accepts.length === 0) {
    return { compatible: false, target, descriptor: envelope.descriptor, reason: "target declares no compatible handoff input" };
  }
  const reasons: string[] = [];
  for (const declaration of accepts) {
    const reason = compatibleDeclaration(envelope.descriptor, declaration);
    if (reason === null) {
      const { rowCount, columnCount, bytes, encoding } = envelope.descriptor;
      return {
        compatible: true,
        target,
        acceptedBy: declaration,
        descriptor: envelope.descriptor,
        preview: `${rowCount} data row${rowCount === 1 ? "" : "s"} × ${columnCount} column${columnCount === 1 ? "" : "s"} · ${bytes} bytes · ${encoding}`,
        lossy: false,
      };
    }
    reasons.push(reason);
  }
  return {
    compatible: false,
    target,
    descriptor: envelope.descriptor,
    reason: [...new Set(reasons)].join("; "),
  };
}

export function compatibleHandoffTargets(
  envelope: TableHandoffEnvelope,
  tools: readonly ToolSummary[],
): Array<Extract<HandoffProposal, { compatible: true }>> {
  return tools
    .map((tool) => proposeHandoff(envelope, tool))
    .filter((proposal): proposal is Extract<HandoffProposal, { compatible: true }> => proposal.compatible);
}

const MESSAGE_KIND = "strumentiutili-handoff-v1";
const MAX_HANDOFF_BYTES = 2 * 1024 * 1024;
const MAX_HANDOFF_ROWS = 100_000;
const MAX_HANDOFF_COLUMNS = 1_000;

export interface HandoffTelemetryOptions {
  sourceToolId: string;
  adapter?: TelemetryAdapter;
}

function isTableHandoffEnvelope(value: unknown): value is TableHandoffEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const envelope = value as Partial<TableHandoffEnvelope>;
  if (typeof envelope.payload !== "string" || typeof envelope.descriptor !== "object" || envelope.descriptor === null) return false;
  const descriptor = envelope.descriptor as Partial<TableHandoffDescriptor>;
  if (
    descriptor.type !== "table" || descriptor.format !== "csv" || descriptor.version !== 1 || descriptor.encoding !== "utf-8" ||
    !Number.isInteger(descriptor.bytes) || (descriptor.bytes ?? -1) < 0 ||
    !Number.isInteger(descriptor.rowCount) || (descriptor.rowCount ?? -1) < 0 ||
    !Number.isInteger(descriptor.columnCount) || (descriptor.columnCount ?? -1) < 0 ||
    !Array.isArray(descriptor.columns) || descriptor.columns.some((column) => typeof column !== "string") ||
    typeof descriptor.duplicateHeaders !== "boolean" || typeof descriptor.raggedRows !== "boolean"
  ) return false;
  if (descriptor.columnCount !== descriptor.columns.length ||
    (descriptor.bytes ?? 0) > MAX_HANDOFF_BYTES ||
    (descriptor.rowCount ?? 0) > MAX_HANDOFF_ROWS ||
    (descriptor.columnCount ?? 0) > MAX_HANDOFF_COLUMNS) return false;
  return descriptor.bytes === new TextEncoder().encode(envelope.payload).byteLength;
}

export function openHandoffTarget(
  proposal: Extract<HandoffProposal, { compatible: true }>,
  envelope: TableHandoffEnvelope,
  telemetry?: HandoffTelemetryOptions,
): boolean {
  if (!isLocalToolRoute(proposal.target.route) || !isTableHandoffEnvelope(envelope)) return false;
  const token = crypto.randomUUID();
  const targetWindow = window.open(`${proposal.target.route}/#handoff=${encodeURIComponent(token)}`, "_blank");
  if (targetWindow === null) return false;
  if (telemetry !== undefined) {
    trackHandoffUsed(
      telemetry.adapter ?? getTelemetryAdapter(),
      telemetry.sourceToolId,
      proposal.target.id,
      envelope.descriptor.type,
    );
  }
  const origin = window.location.origin;
  const timeout = window.setTimeout(() => window.removeEventListener("message", listener), 30_000);
  const listener = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== targetWindow) return;
    const data = event.data as { kind?: string; token?: string; phase?: string };
    if (data.kind !== MESSAGE_KIND || data.token !== token || data.phase !== "ready") return;
    targetWindow.postMessage({ kind: MESSAGE_KIND, token, phase: "payload", envelope }, origin);
    window.clearTimeout(timeout);
    window.removeEventListener("message", listener);
  };
  window.addEventListener("message", listener);
  return true;
}

export function receiveHandoffFromOpener(
  target: ToolSummary,
  onReceive: (envelope: TableHandoffEnvelope, proposal: Extract<HandoffProposal, { compatible: true }>) => void,
): () => void {
  const match = /^#handoff=([^&]+)$/u.exec(window.location.hash);
  const token = match?.[1] === undefined ? null : decodeURIComponent(match[1]);
  const opener = window.opener;
  if (token === null || opener === null) return () => undefined;
  const origin = window.location.origin;
  const listener = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== opener) return;
    const data = event.data as { kind?: string; token?: string; phase?: string; envelope?: unknown };
    if (data.kind !== MESSAGE_KIND || data.token !== token || data.phase !== "payload" || !isTableHandoffEnvelope(data.envelope)) return;
    const proposal = proposeHandoff(data.envelope, target);
    if (!proposal.compatible) return;
    history.replaceState(null, "", window.location.pathname);
    onReceive(data.envelope, proposal);
    window.removeEventListener("message", listener);
  };
  window.addEventListener("message", listener);
  opener.postMessage({ kind: MESSAGE_KIND, token, phase: "ready" }, origin);
  return () => window.removeEventListener("message", listener);
}
