# 278 — Physical iOS Safari image-resize acceptance

**What to build:** Run the existing image-resize acceptance on real iOS Safari, capture current-build evidence and output verification, and record any Safari-specific limitations instead of substituting simulator/desktop evidence.

**Traces to:** AC-09.1; DEC-EXP-06

**Constraints:** C-EXP-02, C-EXP-04; web Safari evidence, not native-app ios-qa.

**Blocked by:** The paired physical iPhone is available again, but SafariDriver cannot create a physical Safari session because Web Inspector is disabled on the device. Web Inspector must be enabled before the real Files/Photos picker, resize and download boundary can be exercised.

**Status:** blocked

**Suggested skills:** qa-browser

- [ ] Receipt identifies physical iOS/Safari/build fingerprint.
- [ ] File picker/resize/download and output facts are verified on-device.
- [x] Failure/limitation remains a blocker rather than being masked by desktop WebKit.

**Verification:** Physical iOS Safari run with screenshots/console/output artifact receipt.

**Device check (2026-10-07, latest retry):** `xcrun devicectl list devices` reports physical `iPhone di Domenico` UDID `00008120-0006384E14D8201E`, iPhone 14 Pro Max (`iPhone15,3`), `State=available (paired)`. `devicectl device info details` reports iOS 26.6.2 build 23G90 and Developer Mode enabled. `/usr/bin/safaridriver --version` reports Safari 26.6.2 (21624.5.1.11.3). A fresh physical session-create attempt was made against the exact UDID and failed closed with `Web Inspector is not enabled on device`; the refreshed JSON evidence remains at `.scratch/strumentiutili-expansion-20261005/evidence/ticket278/safaridriver-physical-attempt.json` and no canonical PASS receipt was written.

**Physical SafariDriver attempt (2026-10-06):** Added the bounded fail-closed runner `scripts/acceptance-image-resize-ios-physical-webdriver.mjs`. It requests `platformName=iOS`, `safari:useSimulator=false`, `safari:deviceType=iPhone` and the exact physical UDID. The current boundary fixture is `image-resize-boundary-4000x4000.jpg` (16,000,000 pixels, SHA-256 `ca8455d8504b35c80a29ec12d8fd03f056786fb622715af5d0fbb9695a1e45b2`) with target 1200×1200 JPEG. SafariDriver reports `Included with Safari 26.6.2 (21624.5.1.11.3)`, finds the named physical phone, and refuses session creation with `Web Inspector is not enabled on device`. The exact attempt is recorded at `.scratch/strumentiutili-expansion-20261005/evidence/ticket278/safaridriver-physical-attempt.json`; `canonicalReceiptWritten=false`.

**Secondary device state:** A direct CoreDevice launch of MobileSafari was denied because the phone was locked at that moment. A physical screenshot was captured at `.scratch/strumentiutili-expansion-20261005/evidence/ticket278/device-screen.png`. This supports the blocker only and is not acceptance evidence.

**Why this remains open:** No WebDriver page command reached Image Resize, so the real Files/Photos picker, 16 MP resize, actual download, reopened artifact dimensions/type/bytes and no-crash/mobile-layout checks remain unobserved. WebDriver `Send Keys` or page-side blob inspection alone would not be counted as proof of the native picker/download boundary. No `quality/receipts/image-resize/ios-safari-physical.json` PASS receipt was created.

**Ticket 229 note:** `safaridriver(1)` states that live media capture is disabled for WebDriver and replaced by mock capture devices/streams. This path therefore cannot prove physical microphone permission/capture acceptance for ticket 229.
