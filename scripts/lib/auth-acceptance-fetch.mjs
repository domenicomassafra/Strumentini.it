// Consumer-only transport; production auth and its admission limits are untouched.
export async function authAcceptanceFetch(url, init, retryKdf = true) {
  const response = await fetch(url, init);
  if (!retryKdf || response.status !== 429 || response.headers.get("retry-after") !== "60") return response;
  // Match the private KDF admission signal only; keep final limiter probes raw.
  await response.body?.cancel();
  await new Promise((resolve) => setTimeout(resolve, 60_000));
  return fetch(url, init);
}
