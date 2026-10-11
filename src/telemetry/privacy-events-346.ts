/**
 * #346 anonymous technical outcomes for an explicitly opted-in VALIDATION
 * cohort. Tool runtime already reports genuine tool_completed/tool_failed;
 * this projection removes tool IDs, subject IDs, raw values and precise times.
 *
 * Existing longitudinal/reporting events are deliberately not forwarded.
 * A successful track() schedules eligibility verification; network delivery is
 * conditional on a freshly checked authenticated session, current consent,
 * and the still-active adapter at the exact point of dispatch.
 */
import {
  type TelemetryAdapter,
  type TelemetryTrackResult,
  type TelemetryTransport,
  noopTelemetryAdapter,
} from "./adapter";
import { hasValidationTelemetryConsent, type TelemetryConsentStorage } from "./consent";
import {
  validateTelemetryEvent,
  type ValidatedTelemetryEvent,
  type ValidationCohort,
} from "./schema";

export interface PrivacySafeOutcomeOptions346 {
  readonly enabled?: boolean | undefined;
  readonly disclosed?: boolean | undefined;
  readonly cohort?: ValidationCohort | undefined;
  readonly storage?: (() => Pick<TelemetryConsentStorage, "getItem"> | null) | undefined;
  /** Must check the actual session at emission, not a remembered profile/ID. */
  readonly authenticated?: (() => Promise<boolean>) | undefined;
  readonly transport?: TelemetryTransport | undefined;
  readonly isActive?: (() => boolean) | undefined;
  readonly now?: (() => Date | number | string) | undefined;
}

const denied: TelemetryTrackResult = Object.freeze({ status: "disabled", accepted: false });
const rejected: TelemetryTrackResult = Object.freeze({ status: "rejected", accepted: false });
const eligible = (options: PrivacySafeOutcomeOptions346): boolean => {
  if (options.enabled !== true || options.disclosed !== true || options.cohort !== "validation" ||
      options.authenticated === undefined || options.transport === undefined ||
      options.storage === undefined) return false;
  try {
    return options.isActive?.() !== false && hasValidationTelemetryConsent(options.storage());
  } catch {
    return false;
  }
};

function anonymousOutcome(input: unknown, now: Date | number | string): ValidatedTelemetryEvent | undefined {
  // Validate the entire original envelope before selecting fields, so a sneaky
  // filename/profile field is refused, not merely hidden in a spread object.
  const original = validateTelemetryEvent(input, now);
  if (!original.ok || (original.event.name !== "tool_completed" && original.event.name !== "tool_failed")) {
    return undefined;
  }
  const { name, properties } = original.event;
  const timestamp = new Date(now);
  if (!Number.isFinite(timestamp.getTime())) return undefined;
  // Day-level event date is enough for aggregate success/error counts.
  timestamp.setUTCHours(0, 0, 0, 0);
  const safeProperties = name === "tool_completed"
    ? {
      outcome: "success",
      ...(properties.tool_family === undefined ? {} : { tool_family: properties.tool_family }),
      ...(properties.duration_bucket === undefined ? {} : { duration_bucket: properties.duration_bucket }),
    }
    : {
      outcome: "error",
      error_code: properties.error_code,
      ...(properties.tool_family === undefined ? {} : { tool_family: properties.tool_family }),
    };
  const outcome = validateTelemetryEvent({
    name: "validation_operation_result",
    cohort: "validation",
    occurredAt: timestamp.toISOString(),
    properties: safeProperties,
  }, timestamp);
  return outcome.ok ? outcome.event : undefined;
}

export function createPrivacySafeOutcomeAdapter(
  options: PrivacySafeOutcomeOptions346 = {},
): TelemetryAdapter {
  if (options.enabled !== true || options.disclosed !== true || options.cohort !== "validation" ||
      options.transport === undefined || options.authenticated === undefined ||
      options.storage === undefined) return noopTelemetryAdapter;
  const authenticatedSession = options.authenticated;
  const transport = options.transport;
  return {
    track(input: unknown): TelemetryTrackResult {
      if (!eligible(options)) return denied;
      let event: ValidatedTelemetryEvent | undefined;
      try {
        event = anonymousOutcome(input, (options.now ?? (() => new Date()))());
      } catch {
        return rejected;
      }
      if (event === undefined) return rejected;
      // Never hold raw input across an await, even in a closure. Only a
      // validator-produced anonymous event is retained for this dispatch.
      const safeEvent = event;
      try {
        // The authentication request begins only after explicit consent.
        // A missing/expired session or network denial cannot trigger a send.
        void Promise.resolve(authenticatedSession()).then(async (authenticated) => {
          if (authenticated !== true || !eligible(options)) return;
          await transport.send(safeEvent);
        }).catch(() => undefined);
        return { status: "accepted", accepted: true, event: safeEvent };
      } catch {
        return { status: "blocked", accepted: false };
      }
    },
  };
}
