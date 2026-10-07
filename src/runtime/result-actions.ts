import type { ResultCapability, ResultDeclaration } from "../catalog/manifest";
import type { OutputArtifactDescriptor } from "./output-artifact";

export const RESULT_ACTION_IDS = [
  "copy",
  "download",
  "download-all",
  "share",
  "reuse",
  "retry",
  "reset",
  "handoff",
] as const;

export type ResultActionId = (typeof RESULT_ACTION_IDS)[number];

export interface ResultAction {
  readonly id: ResultActionId;
  readonly label: string;
  readonly primary: boolean;
}

export interface ResultActionContext {
  readonly declaration: ResultDeclaration;
  /** Explicit semantic primary action. Null means the result has no primary action. */
  readonly primary: ResultActionId | null;
  readonly hasCopyPayload?: boolean;
  readonly artifact?: OutputArtifactDescriptor;
  readonly downloadAllReady?: boolean;
  readonly shareReady?: boolean;
  readonly reuseReady?: boolean;
  readonly retryReady?: boolean;
  readonly resetReady?: boolean;
  readonly handoff?: {
    readonly type: "table";
    readonly format: "csv";
    readonly compatibleTargets: number;
  };
}

const LABELS: Readonly<Record<ResultActionId, string>> = {
  copy: "Copia risultato",
  download: "Scarica risultato",
  "download-all": "Scarica tutto",
  share: "Condividi",
  reuse: "Riusa come input",
  retry: "Riprova",
  reset: "Reimposta",
  handoff: "Passa a uno strumento compatibile",
};

const ACTION_CAPABILITY: Readonly<Record<ResultActionId, ResultCapability>> = {
  copy: "copy",
  download: "download",
  "download-all": "download-all",
  share: "share",
  reuse: "reuse",
  retry: "retry",
  reset: "reset",
  handoff: "handoff",
};

function isReady(id: ResultActionId, context: ResultActionContext): boolean {
  switch (id) {
    case "copy":
      return context.hasCopyPayload === true;
    case "download":
      return context.artifact?.download.ready === true;
    case "download-all":
      return context.downloadAllReady === true;
    case "share":
      return context.shareReady === true;
    case "reuse":
      return context.reuseReady === true;
    case "retry":
      return context.retryReady === true;
    case "reset":
      return context.resetReady === true;
    case "handoff":
      // Binary/file handoff stays unavailable until its dedicated runtime contract lands.
      return context.handoff?.type === "table"
        && context.handoff.format === "csv"
        && context.handoff.compatibleTargets > 0;
  }
}

export function resolveResultActions(context: ResultActionContext): readonly ResultAction[] {
  const declared = new Set(context.declaration.capabilities);
  const actions = RESULT_ACTION_IDS
    .filter((id) => declared.has(ACTION_CAPABILITY[id]) && isReady(id, context))
    .map((id): ResultAction => ({ id, label: LABELS[id], primary: context.primary === id }));

  if (context.primary !== null) {
    if (!declared.has(ACTION_CAPABILITY[context.primary])) {
      throw new Error(`Primary result action ${context.primary} is not declared by the result capabilities.`);
    }
    if (!actions.some((action) => action.id === context.primary)) {
      throw new Error(`Primary result action ${context.primary} is not currently available.`);
    }
  }

  return actions;
}
