import { getTelemetryAdapter } from "../telemetry/browser";
import { trackOnboardingCompleted } from "../telemetry/events";
import type { TelemetryAdapter } from "../telemetry/adapter";
import type { OnboardingContextId } from "../telemetry/schema";

export interface OnboardingTelemetryOptions {
  adapter?: TelemetryAdapter;
  subjectId?: string;
}

export function recordOnboardingCompleted(
  contextId: OnboardingContextId,
  options: OnboardingTelemetryOptions = {},
): void {
  trackOnboardingCompleted(
    options.adapter ?? getTelemetryAdapter(),
    contextId,
    options.subjectId === undefined ? {} : { subjectId: options.subjectId },
  );
}
