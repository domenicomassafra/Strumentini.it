export function now() {
  return performance.now();
}

export function heapUsed() {
  return typeof performance.memory?.usedJSHeapSize === "number"
    ? performance.memory.usedJSHeapSize
    : null;
}

export function finish(result) {
  const payload = {
    ...result,
    userAgent: navigator.userAgent,
    crossOriginIsolated: self.crossOriginIsolated === true,
  };
  window.__STRUMENTIUTILI_SPIKE_RESULT__ = payload;
  const out = document.querySelector("#result");
  if (out) out.textContent = JSON.stringify(payload, null, 2);
  document.documentElement.dataset.spikeState = "complete";
}

export function fail(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  window.__STRUMENTIUTILI_SPIKE_RESULT__ = { ok: false, error: message };
  const out = document.querySelector("#result");
  if (out) out.textContent = message;
  document.documentElement.dataset.spikeState = "failed";
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
