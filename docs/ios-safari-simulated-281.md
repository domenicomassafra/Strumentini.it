# STR-281 — Safari mobile WebKit acceptance (simulated)

This reusable lane exercises the built static consumer at /tools/image-resize/
and /tools/audio-generator/, with the iPhone 17 Playwright WebKit descriptor,
real local file inputs, refusal/retry, cancellation where observable, Blob
downloads, independent file reopening and same-origin network checks.

It runs **macOS WebKit with mobile emulation**. It is **not** physical iOS Safari
or a native Safari session in the iOS Simulator. The receipt explicitly says
SIMULATED_DESKTOP_WEBKIT_MOBILE and physicalDeviceObserved=false.
The native SafariDriver session attempted on 2026-10-19 with platformName=iOS,
safari:useSimulator=true and the booted simulator's UDID was rejected with
"session not created". Do not promote these results to physical Gold.

Separate real **iOS 27 Simulator / iPhone 17e Safari navigation smoke**
was observed with Xcode simctl, serving the same dist over loopback:
the browser rendered both routes, and screenshots from simctl io screenshot
are in quality/receipts/ios-safari-281-simulator-image-resize.png
(SHA-256 4cdff29b1186f05345c0f65f79cc58bd5b16581e10aacf6f740203a81ddaac63)
and quality/receipts/ios-safari-281-simulator-audio-generator.png
(SHA-256 f8ee876ac1f22dc063bd2cea692fe9f2e834e772053a361ab0c22ee132326c7b).
These screenshots support **native simulator route rendering only**.
They do not prove native file-picking, output download or Share sheet.

Run after dependencies are installed (Node 26 is the project target):

1. npm run build
2. npm run acceptance:ios-safari-sim
3. npx vitest run tests/regroom-str-281.test.ts --maxWorkers=1

The pinned WebKit browser can be installed once via npx playwright install webkit.
The existing fixture generator creates a 16 MP JPEG at the image policy
boundary; this lane checks its SHA-256, exercises it through the browser,
rejects a corrupt negative input, and reopens the actual downloaded JPEG.
The audio route uses valid and malformed WAV inputs, holds a real Worker job
to cancel it, retries, and independently checks the downloaded RIFF PCM16
bytes. Built route HTML SHA-256 hashes, the source revision and the aggregate
build fingerprint are in quality/receipts/ios-safari-simulated-281.json.

Each route records actual input/download Blob bytes and a policy-estimated
resource amount. Image Resize's 96 MiB ceiling is a decoded working-set
policy; Audio Generator's 24 MiB ceiling applies to total *input*, not
to peak audio Worker heap. Safari JS heap/canvas/WASM peak **cannot be measured reliably**
here, so observedPeakBytes is null. Playwright file selection does not show the
native iOS Files/Photos picker. Native share sheet, native Safari download
placement and Files reopening are NOT_RUN. A fast image operation can finish
before the cancel button becomes actionable; its limitation must be recorded.
Failing routes remain FAIL in the receipt, and the command exits nonzero.

The validator in scripts/lib/ios-safari-sim-281.ts rejects forged physical
evidence, missing/mismatched fingerprints, lost Blob/download proofs, invalid
resource bounds, absent recovery or offsite/upload traffic. Positive and
negative fixture tests are in tests/regroom-str-281.test.ts.

Upstream reuse: Playwright Apache-2.0 (github.com/microsoft/playwright),
Apple SafariDriver native to Xcode, and the repository's existing heavy local
runtime/fixture generator/audio browser-acceptance implementations. Appium
Apache-2.0 (github.com/appium/appium) is an active alternative for a future
native iOS Simulator XCUITest adapter; no duplicate driver was installed.
