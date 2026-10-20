# STR-363 — Android Emulator raw observations, PARTIAL (2026-10-20)

Independent Android Chrome AVD audit of draft PR #380 at exact source revision `0be8efe745bb567dd9216afe80a4bab4fe2e8760`. **This is not an accepted device receipt, a physical-phone claim, nor an automatic PASS**. The official `mobile-memory-363-simulated.json` retains **36/36 NOT_RUN**. The iOS Simulator remains owned by #106.

Observed environment: AVD `str277-api35`, emulator serial `emulator-5554`, Android 15/API35, build fingerprint `google/sdk_gphone64_x86_64/emu64xa:15/AE3A.240806.036/12592187:user/release-keys`, installed Chrome `124.0.6367.219`. Real compiled route `/tools/image-resize/` SHA256 `ca2d0b91b119433259e9e5d3ff13fc3f5ff2f4a5272d56e3367a92ec37c62e76`. Runtime Node 26 on MiniPC under flock heavy lock; `tests/regroom-str-363.test.ts` 8/8 and compiled build 308 pages passed. The 6 cases were exercised in installed Android Chrome via CDP file-input injection, with an actual browser resize, actual Android Downloads output, `adb pull`, and independent Sharp/libvips JPEG decode. These **are not native-picker cases**. No offsite page requests or pageerrors were seen during the six operations.

| Input | phase | source bytes | downloaded JPEG bytes | sampled JS heap peak bytes | rAF max frame gap ms | pointer-to-next-rAF ms | action→output ms |
|---|---|---:|---:|---:|---:|---:|---:|
| S 320×240 | cold | 96,901 | 7,701 | 6,864,856 | 150.0 | 14.0 | 2,481.7 |
| S 320×240 | warm | 96,901 | 7,701 | 7,961,172 | 100.0 | 0.0 | 1,982.6 |
| M 1280×960 | cold | 1,522,241 | 143,686 | 27,616,740 | 133.2 | 15.4 | 2,287.6 |
| M 1280×960 | warm | 1,522,241 | 143,686 | 8,748,304 | 100.0 | 2.2 | 2,009.4 |
| L 2400×1800 | cold | 4,934,140 | 433,923 | 61,365,868 | 183.4 | 10.0 | 2,788.5 |
| L 2400×1800 | warm | 4,934,140 | 433,923 | 10,229,800 | 366.7 | 21.5 | 3,032.7 |

Caveats: `Performance.getMetrics` JSHeapUsedSize samples are the renderer's **JS heap**, not complete browser memory; source input injection allocations contribute to the before/peak values. `adb shell dumpsys meminfo -d com.android.chrome` separately reports main Chrome process PSS only, **not** all sandboxed renderers. `rAF` interval maxima reflect scheduling under CDP automation and are not independent jank thresholds. Metrics are bounded samples, not guaranteed true global peaks or universal budgets. Each case's before/after/PSS, input hash, output hash, raw timing, sample count, device identity and limitation live in the JSON. The raw JSON's SHA256 is `4f66cee020a94865952aa2e9ad0bcd294727526a3597ab6453bdc8dcc161fca3`.

Raw **binary** fixtures/downloads remain untouched on MiniPC in `~/Code/.worktrees/strumentini-it-124-audit/.tmp-str363-android/`, as a private audit directory. Each source/output byte stream is hashed in the raw JSON; the independent script `scripts/verify-mobile-memory-363-android-audit.mjs` uses those local streams, actual checkout source SHA, actual built HTML SHA and Sharp/libvips to check the files. Output status `PARTIAL_RAW_CROSSCHECKED_REVIEW_REQUIRED` does not authenticate CDP events or simulator session ownership, which requires independent review. Large generated files are intentionally excluded from Git due the repository's 20 KiB-per-new-file policy; therefore a remote checkout lacking these private files cannot repeat byte-level decoding from this branch alone.

Additional Android recovery exploration (in private `.tmp-str363-android/str363-android-recovery-partial.json`): one run confirmed Cancel while processing produced no result, retry produced an output link, then Android HOME/background and return preserved the DOM link. A click to redownload after background was blocked by Chrome tab visibility (`locator.click` timeout); repeat encountered the same foreground visibility blocker at submit. **No independently reopened output after background**, no complete recovery proof. Controlled OOM/preflight was not reached and actual OOM was not induced. All recovery fields in the main raw matrix remain `NOT_RUN`; this is an intentionally conservative classification.

Unmeasured: iOS Simulator all 18 cases; Android PDF and CSV all 12 cases; full cancel/background/retry/controlled-preflight/reopen scenario per matrix. Keep PR #380 draft and issue #124 open. Do not promote the six partial observations into 36-row PASS until complete device evidence and owner independent trace review exist.

Provenance/rights: the audit reused installed `@playwright/test@1.63.0` (Apache-2.0) for Android Chrome CDP and `sharp@0.35.5` (Apache-2.0) to independently reopen files; the consumer already uses pinned `pica@10.0.3` (MIT). No donor source or new production dependency was introduced. Evidence-only audit branch; unchanged writer-owned PR #380 and all 36 NOT_RUN.
