# STR-461 native picker acceptance on the compiled consumer

Run only on the Mac Studio, under the resource guard and with exclusive use of
the already-running Android emulator. The existing Playwright 1.63.0
(Apache-2.0) and Sharp dependencies are reused. No application dependency,
remote upload service, or third-party application is required.

```sh
python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- npm ci
python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- /bin/sh -c 'npm run catalog:build && npx vitest run tests/regroom-str-336.test.ts tests/str-336-acceptance.test.ts tests/str-336-refusals.test.ts --maxWorkers=1 && npm run check && npm run build'
python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- /bin/bash scripts/run-android-native-picker-461.sh
```

The Android runner uses the installed Chrome app and Android system UI through
ADB on the MiniPC. An SSH tunnel connects the compiled consumer served on the
Studio to the existing AVD. The native file choice is driven through the
Android picker; the browser's received bytes are compared to the original
fixture by SHA-256. It opens the exported JPEG from the Android Downloads
directory with Sharp, checks full pixel decoding, and captures OS/browser/build
fingerprints. It also probes system Back, app background/resume, sharing, and
rejection of a malformed image. Its working receipts and artifacts remain in
`.scratch/str461-*`, not in canonical release receipts.

**This runner is intentionally fail-closed.** A successful Android image
selection is a partial native observation and ends with exit code 2 because
the full STR-461 matrix also requires distinct Photos and Files picker flows,
permission denial/retry, downloaded/shared outputs, and the corresponding
iOS Simulator Safari evidence. Any unobserved stage must say `NOT_RUN`.
The original `scripts/lib/mobile-picker-receipt-336.ts` validator is the
canonical complete-evidence contract; the partial Android JSON is not a
substitute for a receipt that passes that validator.

Do not run an iOS Simulator during daytime or start a second emulator. The
global host contract allows one resource-guarded simulator at a time, in the
night window, followed by shutdown. A desktop WebKit mobile profile and
`simctl openurl` cannot attest that Safari's native picker or share sheet was
opened. Production release remains governed by issues #80 and #162.
