# 203 — WiFi QR preset on existing QR generator

**What to build:** Extend the existing QR generator with Wi-Fi payload presets and escaping rules instead of a new QR engine/route unless search-intent policy proves a distinct route.

**Traces to:** US-EXP-05, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 99, 104.

**Status:** completed

**Suggested skills:** security-audit → code-typescript → code-tdd → qa-browser

- [x] SSID/password/security/hidden fields encode with Wi-Fi QR escaping for `\\`, `;`, `,`, `:` and `"`.
- [x] Wi-Fi credentials live only in component/runtime state; they are not written to URL/history or sent over network.
- [x] Existing `generateQr` remains the sole canonical QR encoder and the Wi-Fi preset only constructs its payload.

**Verification:** `tests/qr-local-engine.test.ts` covers escaping, Unicode, no-password/hidden payloads and QR matrix decode round-trip.
