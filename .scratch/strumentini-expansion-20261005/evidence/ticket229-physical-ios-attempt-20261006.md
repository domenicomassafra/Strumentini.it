# Ticket 229 — physical iOS Safari attempt — 2026-10-06

This is a blocked-attempt record, not a PASS receipt.

## Physical device fingerprint

- Device: iPhone di Domenico
- Model: iPhone 14 Pro Max (iPhone15,3)
- UDID: 00008120-0006384E14D8201E
- Reality: physical
- Pairing/state: available (paired), connected
- Developer Mode: enabled
- iOS: 26.6.2
- iOS build: 23G90
- Safari/safaridriver: Safari 26.6.2, safaridriver 21624.5.1.11.3
- Xcode: 27.0 (27A266a)

## What was genuinely attempted

1. `xcrun devicectl list devices` and `device info details` confirmed the exact physical device above.
2. A Safari WebDriver session was requested with all of these physical-only selectors:
   - `platformName=iOS`
   - `safari:useSimulator=false`
   - `safari:deviceType=iPhone`
   - `safari:deviceUDID=00008120-0006384E14D8201E`
   - `safari:platformVersion=26.6.2`
   - `safari:platformBuildVersion=23G90`
3. safaridriver found that exact phone but refused the session with:

   `Could not create a session: Some devices were found, but could not be used: - iPhone di Domenico (00008120-0006384E14D8201E): Web Inspector is not enabled on device`

4. `devicectl settings` was inspected. Its exposed setting subcommands cover appearance, audio, biometrics, reset and VoiceOver; there is no Web Inspector toggle exposed there.
5. A local static server was bound on the Mac LAN and Safari was launched on the physical phone with the ticket-229 URL. The server received real requests from the iPhone at `192.168.1.31`, including:
   - `GET /tools/microphone-recorder/ 200`
   - the route CSS/JS
   - `MicrophoneRecorderTool` bundle
   - `browser-audio` bundle
6. CoreDevice screenshots were captured from the real 1290×2796 display:
   - `ticket229-iphone14promax-safari-page.png`
   - `ticket229-iphone14promax-safari-page-after-load.png`
   - `ticket229-iphone14promax-safari-home-control.png`
   - `ticket229-iphone14promax-safari-home-control-after3s.png`

   The Safari captures were not reliable enough to certify the loaded app state: captures after launch were black or showed the prior Safari tab even though the server logged the physical phone fetching the target route.

## Why ticket 229 is still physically blocked

- Current safaridriver control cannot start because Web Inspector is disabled on the phone.
- The available `devicectl` CLI can launch Safari and capture screenshots but exposes no command in its public subcommand surface to tap the real page controls or native permission picker.
- More importantly, the installed safaridriver documentation explicitly states: “For security reasons, Safari does not permit live media capture during a WebDriver test session. Instead, mock capture devices and streams with well-known contents are provided for testing purposes.”
- Therefore even after Web Inspector is enabled, a safaridriver recording flow would not be truthful evidence of the real microphone permission picker or live physical microphone capture required by ticket 229.

No physical PASS receipt was created. The real permission picker, live-microphone record/pause/resume/stop, local playback/download and no-crash flow remain unobserved on physical Safari.

## Relevance to ticket 278

This physical setup is materially better for ticket 278 because image resize does not depend on live media capture. Once Web Inspector is enabled, safaridriver can target this exact physical iPhone with `safari:useSimulator=false` and the UDID above. The LAN route is already proven reachable from the phone.

However, the current attempt does not yet prove that SafariDriver can complete and observe the native file picker and downloaded output on this device. Until those native/file-system steps are actually exercised and the resized artifact is verified on-device, ticket 278 must remain open.
