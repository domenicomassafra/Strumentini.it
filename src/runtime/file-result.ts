import type { RuntimeLocation } from "../catalog/manifest";
import type { OutputArtifactDescriptor } from "./output-artifact";

export const FILE_RESULT_STATUSES = ["queued", "running", "success", "warning", "partial", "error", "cancelled"] as const;
export type FileResultStatus = (typeof FILE_RESULT_STATUSES)[number];

export interface FileResultSource {
  readonly name: string;
  readonly byteLength: number;
  readonly detectedMime?: string;
}

export interface FileResultItem {
  readonly id: string;
  readonly source: FileResultSource;
  readonly status: FileResultStatus;
  readonly progress?: number;
  readonly artifact?: OutputArtifactDescriptor;
  readonly message?: string;
  readonly retryable: boolean;
  readonly cancellable: boolean;
  readonly beforeBytes?: number;
  readonly afterBytes?: number;
}

export interface FileWorkspaceRuntimePolicy {
  readonly location: RuntimeLocation;
  readonly network: "forbidden" | "reference-only" | "required";
}

export interface FileResultWorkspaceModel {
  readonly items: readonly FileResultItem[];
  readonly runtime: FileWorkspaceRuntimePolicy;
  readonly privacyCopy: string;
}

function finiteBytes(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value;
}

export function fileWorkspacePrivacyCopy(runtime: FileWorkspaceRuntimePolicy): string {
  if (runtime.location === "LOCAL" && runtime.network === "forbidden") {
    return "I file vengono elaborati in questo browser e il contenuto non viene inviato in rete.";
  }
  if (runtime.location === "REFERENCE" && runtime.network === "reference-only") {
    return "Il file resta nel browser; lo strumento può usare la rete solo per dati di riferimento dichiarati.";
  }
  if ((runtime.location === "REMOTE" || runtime.location === "AI") && runtime.network === "required") {
    return "Questa operazione richiede rete e può inviare il contenuto al servizio dichiarato prima dell'esecuzione.";
  }
  throw new Error(`Unsupported runtime/network policy: ${runtime.location}/${runtime.network}`);
}

export function createFileResultItem(input: Omit<FileResultItem, "retryable" | "cancellable"> & {
  readonly retryable?: boolean;
  readonly cancellable?: boolean;
}): FileResultItem {
  const id = input.id.trim();
  const name = input.source.name.trim();
  if (id === "") throw new TypeError("File result id is required.");
  if (name === "") throw new TypeError("File result source name is required.");
  finiteBytes(input.source.byteLength, "source.byteLength");
  if (input.beforeBytes !== undefined) finiteBytes(input.beforeBytes, "beforeBytes");
  if (input.afterBytes !== undefined) finiteBytes(input.afterBytes, "afterBytes");
  if (input.progress !== undefined && (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 1)) {
    throw new RangeError("progress must be between 0 and 1");
  }
  if (input.status === "success" && input.artifact === undefined) {
    throw new Error("Successful file results require an output artifact.");
  }
  if (input.artifact !== undefined && input.afterBytes !== undefined && input.artifact.byteLength !== input.afterBytes) {
    throw new Error("afterBytes must match the authoritative output artifact byte length.");
  }

  return {
    ...input,
    id,
    source: { ...input.source, name },
    retryable: input.retryable ?? (input.status === "error" || input.status === "cancelled"),
    cancellable: input.cancellable ?? input.status === "running",
  };
}

export function createFileResultWorkspace(
  items: readonly FileResultItem[],
  runtime: FileWorkspaceRuntimePolicy,
): FileResultWorkspaceModel {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate file result id: ${item.id}`);
    ids.add(item.id);
  }
  return {
    items: [...items],
    runtime,
    privacyCopy: fileWorkspacePrivacyCopy(runtime),
  };
}
