import type { ToolSummary } from "../catalog/manifest";
import type { ToolEntrySource } from "../telemetry/schema";

export type DefaultProvenance =
  | "explicit"
  | "profile"
  | "tool-default"
  | "system-derived";

export interface ResolvedDefault {
  field: string;
  value: unknown;
  provenance: DefaultProvenance;
}

export interface ToolExecutionContext {
  defaults: Readonly<Record<string, ResolvedDefault>>;
}

export interface RuntimeTelemetryContext {
  entrySource?: ToolEntrySource;
  telemetrySubjectId?: string;
}

export interface ToolModule {
  run(
    input: unknown,
    context: ToolExecutionContext,
    signal?: AbortSignal,
  ): Promise<unknown> | unknown;
}

export type ToolRunResult =
  | {
      ok: true;
      tool: ToolSummary;
      value: unknown;
      defaults: readonly ResolvedDefault[];
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "INVALID_INPUT" | "CANCELLED" | "RUNTIME_ERROR";
      message: string;
    };

export type PreflightResult =
  | { ok: true; tool: ToolSummary }
  | { ok: false; code: "NOT_FOUND"; message: string };
