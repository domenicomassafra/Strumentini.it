import type { OutputArtifactDescriptor } from "./output-artifact";

export const BATCH_ITEM_STATUSES = ["queued", "running", "success", "error", "cancelled", "unsupported"] as const;
export type BatchItemStatus = (typeof BATCH_ITEM_STATUSES)[number];

export interface BatchResultItem {
  readonly id: string;
  readonly label: string;
  readonly status: BatchItemStatus;
  readonly artifact?: OutputArtifactDescriptor;
  readonly message?: string;
  readonly retryable?: boolean;
}

export interface BatchResultSummary {
  readonly total: number;
  readonly completed: number;
  readonly successful: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly pending: number;
  readonly retryIds: readonly string[];
  readonly downloadableArtifacts: readonly OutputArtifactDescriptor[];
  readonly canDownloadSuccesses: boolean;
  readonly canDownloadZip: boolean;
}

function isCompleted(status: BatchItemStatus): boolean {
  return status === "success" || status === "error" || status === "cancelled" || status === "unsupported";
}

function isFailed(status: BatchItemStatus): boolean {
  return status === "error" || status === "unsupported";
}

export function summarizeBatchResult(items: readonly BatchResultItem[]): BatchResultSummary {
  const ids = new Set<string>();
  for (const item of items) {
    const id = item.id.trim();
    if (id === "") throw new TypeError("Batch item id is required.");
    if (ids.has(id)) throw new Error(`Duplicate batch item id: ${id}`);
    ids.add(id);
    if (item.status === "success" && item.artifact === undefined) {
      throw new Error(`Successful batch item ${id} requires an output artifact.`);
    }
  }

  const successfulItems = items.filter((item) => item.status === "success");
  const downloadableArtifacts = successfulItems
    .map((item) => item.artifact)
    .filter((artifact): artifact is OutputArtifactDescriptor => artifact?.download.ready === true);
  const retryIds = items
    .filter((item) => (item.retryable ?? (item.status === "error" || item.status === "cancelled")) === true)
    .map((item) => item.id);

  return {
    total: items.length,
    completed: items.filter((item) => isCompleted(item.status)).length,
    successful: successfulItems.length,
    failed: items.filter((item) => isFailed(item.status)).length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    pending: items.filter((item) => item.status === "queued" || item.status === "running").length,
    retryIds,
    downloadableArtifacts,
    canDownloadSuccesses: downloadableArtifacts.length > 0,
    canDownloadZip: downloadableArtifacts.length > 1,
  };
}

export function replaceBatchItem(
  items: readonly BatchResultItem[],
  replacement: BatchResultItem,
): readonly BatchResultItem[] {
  let found = false;
  const next = items.map((item) => {
    if (item.id !== replacement.id) return item;
    found = true;
    return replacement;
  });
  if (!found) throw new Error(`Unknown batch item id: ${replacement.id}`);
  return next;
}
