/**
 * Public deployment identifiers only.
 *
 * The Turnstile site key is intentionally public and embedded in HTML.
 * The matching secret lives only in Cloudflare as TURNSTILE_SECRET.
 */
// PUBLIC_TURNSTILE_SITE_KEY is a build-time *public* identifier, not a secret.
// Staging builds use their own hostname-scoped widget. Production retains the
// existing key when the override is absent; server-side Siteverify is still
// required before any real authentication.
const siteKeyOverride = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY?.trim();
export const TURNSTILE_SITE_KEY = siteKeyOverride || "0x4AAAAAAFMra1fmqLYks6Ct";
