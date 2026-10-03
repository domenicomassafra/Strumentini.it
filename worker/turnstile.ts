/**
 * Cloudflare Turnstile server-side verification.
 *
 * The browser token is never trusted by itself: every non-local login and
 * registration is redeemed through Siteverify. Keeping this in a small module
 * makes the network contract independently testable without a live challenge.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_MAX_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 5_000;

export type TurnstileFailure = "missing-token" | "invalid" | "unavailable";
export type TurnstileVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: TurnstileFailure };

interface SiteverifyResponse {
  readonly success?: unknown;
  readonly hostname?: unknown;
  readonly action?: unknown;
}

export interface TurnstileVerifyInput {
  readonly secret: string;
  readonly token: string;
  readonly remoteIp: string;
  readonly expectedHostname: string;
  readonly expectedAction: "login" | "register";
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function isLocalTurnstileHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export async function verifyTurnstileToken(
  input: TurnstileVerifyInput,
  fetchImpl: FetchLike = fetch,
): Promise<TurnstileVerification> {
  const token = input.token.trim();
  if (token === "" || token.length > TOKEN_MAX_LENGTH) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({
    secret: input.secret,
    response: token,
    remoteip: input.remoteIp,
    idempotency_key: crypto.randomUUID(),
  });

  let response: Response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };

  let payload: SiteverifyResponse;
  try {
    payload = await response.json() as SiteverifyResponse;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (payload.success !== true) return { ok: false, reason: "invalid" };
  if (payload.action !== input.expectedAction) return { ok: false, reason: "invalid" };
  if (payload.hostname !== input.expectedHostname) return { ok: false, reason: "invalid" };
  return { ok: true };
}
