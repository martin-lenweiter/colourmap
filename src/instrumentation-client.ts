import posthog from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_CONTRACTSPEC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2025-05-24',
    capture_dead_clicks: true,
    capture_exceptions: true, // This enables capturing exceptions using Error Tracking
    debug: process.env.NODE_ENV === 'development',
  });
}
