/** #367 browser audit network boundary, installed on a new context before a
 * page exists. Callers must create that context with serviceWorkers: "block".
 * A second local server with a different port is intentionally off-origin.
 */
import type { BrowserContext } from "@playwright/test";

export async function enforceLocalNetwork367(
  context: BrowserContext,
  origin: string,
  blockedAttempts: string[],
): Promise<void> {
  const target = new URL(origin);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || !target.port ||
      target.pathname !== "/" || target.search || target.hash) {
    throw new Error("CODEC_367_INVALID_PROBE_ORIGIN: exact ephemeral loopback listener required");
  }
  await context.route("**/*", async (route) => {
    const address = route.request().url();
    let allowed = false;
    try {
      const parsed = new URL(address);
      allowed = (parsed.protocol === "http:" || parsed.protocol === "blob:") && parsed.origin === target.origin;
    } catch { /* malformed URLs are refused */ }
    if (allowed) await route.continue();
    else {
      blockedAttempts.push(address);
      await route.abort("blockedbyclient");
    }
  });
}
