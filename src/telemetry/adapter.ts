import {
  isSafeTelemetryIdentifier,
  validateTelemetryEvent,
  type TelemetryEventInput,
  type TelemetryValidationResult,
  type ValidatedTelemetryEvent,
  type ValidationCohort,
} from "./schema";

export type TelemetryTrackStatus = "disabled" | "rejected" | "accepted" | "blocked";

export interface TelemetryTrackResult {
  readonly status: TelemetryTrackStatus;
  readonly accepted: boolean;
  readonly event?: ValidatedTelemetryEvent;
  readonly reason?: string;
}

export interface TelemetryTransport {
  send(event: ValidatedTelemetryEvent): void | Promise<void>;
}

export interface TelemetryAdapter {
  track(input: TelemetryEventInput | unknown): TelemetryTrackResult;
}

export interface AllowlistedTelemetryAdapterOptions {
  enabled?: boolean;
  disclosed?: boolean;
  cohort?: ValidationCohort;
  subjectId?: string;
  transport?: TelemetryTransport;
  now?: () => Date | number | string;
}

const disabledResult: TelemetryTrackResult = Object.freeze({ status: "disabled", accepted: false });

export const noopTelemetryAdapter: TelemetryAdapter = Object.freeze({
  track: () => disabledResult,
});

function safeTrack(adapter: TelemetryAdapter, input: unknown): TelemetryTrackResult {
  try {
    return adapter.track(input);
  } catch {
    return { status: "blocked", accepted: false, reason: "Telemetry adapter is unavailable." };
  }
}

function withAdapterContext(
  input: unknown,
  subjectId: string | undefined,
  cohort: ValidationCohort,
): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const source = input as Record<string, unknown>;
  const enriched: Record<string, unknown> = { ...source };
  if (subjectId !== undefined && source.subjectId === undefined && source.subject_id === undefined) {
    enriched.subjectId = subjectId;
  }
  if (source.cohort === undefined) enriched.cohort = cohort;
  return enriched;
}

export function createAllowlistedTelemetryAdapter(
  options: AllowlistedTelemetryAdapterOptions = {},
): TelemetryAdapter {
  const enabled = options.enabled === true && options.disclosed === true && options.cohort === "validation";
  if (!enabled) return noopTelemetryAdapter;
  if (options.subjectId !== undefined && !isSafeTelemetryIdentifier(options.subjectId)) {
    return Object.freeze({
      track: (): TelemetryTrackResult => ({ status: "rejected", accepted: false, reason: "Telemetry subject identifier is not approved." }),
    });
  }
  const now = options.now ?? (() => new Date());
  const subjectId = options.subjectId;
  const cohort: ValidationCohort = "validation";
  const transport = options.transport;

  return {
    track(input: unknown): TelemetryTrackResult {
      let validation: TelemetryValidationResult;
      try {
        validation = validateTelemetryEvent(withAdapterContext(input, subjectId, cohort), now());
      } catch {
        return { status: "rejected", accepted: false, reason: "Telemetry event could not be validated." };
      }
      if (!validation.ok) {
        return { status: "rejected", accepted: false, reason: validation.reason };
      }
      if (transport === undefined) {
        return { status: "accepted", accepted: true, event: validation.event };
      }
      try {
        const sent = transport.send(validation.event);
        if (isPromiseLike(sent)) void Promise.resolve(sent).catch(() => undefined);
        return { status: "accepted", accepted: true, event: validation.event };
      } catch {
        return { status: "blocked", accepted: false, reason: "Telemetry transport is unavailable." };
      }
    },
  };
}

function isPromiseLike(value: unknown): value is Promise<void> {
  if (typeof value !== "object" || value === null) return false;
  const then = (value as { then?: unknown }).then;
  return typeof then === "function";
}

export interface MemoryTelemetryTransport extends TelemetryTransport {
  readonly events: ValidatedTelemetryEvent[];
}

export function createMemoryTelemetryTransport(): MemoryTelemetryTransport {
  const events: ValidatedTelemetryEvent[] = [];
  return {
    events,
    send(event) {
      events.push(structuredClone(event));
    },
  };
}

export function createRecordingTelemetryAdapter(
  transport: TelemetryTransport,
  options: Omit<AllowlistedTelemetryAdapterOptions, "transport"> = {},
): TelemetryAdapter {
  return createAllowlistedTelemetryAdapter({
    ...options,
    enabled: true,
    disclosed: true,
    cohort: "validation",
    transport,
  });
}

export interface HttpTelemetryTransportOptions {
  fetch?: typeof fetch;
  headers?: Readonly<Record<string, string>>;
}

export function createHttpTelemetryTransport(
  endpoint: string,
  options: HttpTelemetryTransportOptions = {},
): TelemetryTransport {
  const fetcher = options.fetch ?? (typeof fetch === "function" ? fetch.bind(globalThis) : undefined);
  return {
    async send(event) {
      if (fetcher === undefined) throw new Error("Fetch is unavailable");
      const response = await fetcher(endpoint, {
        method: "POST",
        credentials: "omit",
        keepalive: true,
        headers: {
          "content-type": "application/json",
          ...options.headers,
        },
        body: JSON.stringify({
          event: event.name,
          properties: event.properties,
          occurred_at: event.occurredAt,
          ...(event.subjectId === undefined ? {} : { subject_id: event.subjectId }),
          cohort: event.cohort,
        }),
      });
      if (!response.ok) throw new Error(`Telemetry request failed: ${response.status}`);
    },
  };
}

export const createTelemetryAdapter = createAllowlistedTelemetryAdapter;

export function createNoopTelemetryAdapter(): TelemetryAdapter {
  return noopTelemetryAdapter;
}

export function trackSafely(adapter: TelemetryAdapter, input: unknown): TelemetryTrackResult {
  return safeTrack(adapter, input);
}
