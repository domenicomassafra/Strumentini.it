# STR-277 AVD receipt — rerun of 8 November 2026

Byte-for-byte copy of the receipt that `scripts/acceptance-android-chrome-avd-277.mjs` wrote on the MiniPC on 2026-11-08 22:44 UTC: Chrome 156.0.8078.73 against build `294b6d8b`, simulated AVD `str277-api35`. It was left uncommitted there and existed nowhere else (Strumentini.it#589, owner decision 18/11/2026: keep it in the repo).

It lives in its own folder because the script writes fixed filenames: committed in place it would replace the 20 October receipt that the release gate reads (`quality/receipts/android-chrome-avd-277.json`, Chrome 124, build `625fdbe5`), which stays the canonical one. The `screenshot.file` field inside the receipt still names the canonical path; the `android-chrome-avd-277-simulated.jpg` next to this file holds exactly those bytes (sha256 `2cc58dfd…`).

Validation: `npx vitest run tests/regroom-str-277.test.ts` keeps covering the canonical receipt; this folder adds no code and no runtime file.
