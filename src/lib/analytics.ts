/**
 * Colourmap analytics — PostHog events for onboarding and check-ins.
 * No PII in props. Keys from env only.
 */

import posthog from 'posthog-js';

export const COLOURMAP_EVENTS = {
  ONBOARDING_COMPLETED: 'colourmap_onboarding_completed',
  ONBOARDING_ERROR: 'colourmap_onboarding_error',
  CHECK_IN_COMPLETED: 'colourmap_check_in_completed',
  CHECK_IN_SKIPPED: 'colourmap_check_in_skipped',
  EXPLORER_OPENED: 'colourmap_explorer_opened',
  DATA_EXPORTED: 'colourmap_data_exported',
  DATA_DELETED: 'colourmap_data_deleted',
  NAV_TO_FUTUREME: 'colourmap_nav_to_futureme',
} as const;

export function trackOnboardingCompleted(hasUploadedContext: boolean) {
  posthog.capture(COLOURMAP_EVENTS.ONBOARDING_COMPLETED, {
    has_uploaded_context: hasUploadedContext,
  });
}

/** Capture onboarding error for observability (no-op if PostHog not initialized) */
export function trackOnboardingError(err: unknown) {
  posthog.capture(COLOURMAP_EVENTS.ONBOARDING_ERROR, {
    error: err instanceof Error ? err.message : String(err),
  });
}

export function trackCheckInCompleted() {
  posthog.capture(COLOURMAP_EVENTS.CHECK_IN_COMPLETED);
}

export function trackCheckInSkipped() {
  posthog.capture(COLOURMAP_EVENTS.CHECK_IN_SKIPPED);
}

export function trackExplorerOpened(space: string) {
  posthog.capture(COLOURMAP_EVENTS.EXPLORER_OPENED, { space });
}

export function trackDataExported() {
  posthog.capture(COLOURMAP_EVENTS.DATA_EXPORTED);
}

export function trackDataDeleted() {
  posthog.capture(COLOURMAP_EVENTS.DATA_DELETED);
}

/** User journey: Colourmap -> FutureMe (Y2 Q1 cross-navigation) */
export function trackNavToFutureMe() {
  posthog.capture(COLOURMAP_EVENTS.NAV_TO_FUTUREME);
}
