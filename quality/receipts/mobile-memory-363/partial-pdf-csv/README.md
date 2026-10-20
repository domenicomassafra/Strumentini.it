# STR-363 #124 — Android PDF/CSV partial observed traces (20 October 2026)

These twelve runs are **real observations from the Android Emulator**, not
complete acceptance. Source/compiled consumer revision:
4031b58258d56aef6a9392ba9ca2da6efe8bb7d9 (PR #380 remains DRAFT).
The emulator was str277-api35, Android 15/API 35, installed Android Chrome
124.0.6367.219. Node 26.12.0 on MiniPC, protected throughout each run by
the shared heavy lock and the exclusive Android AVD flock. Physical phone
use is **not** claimed. The iOS Simulator was reserved by #106.

Each PDF/CSV size S/M/L was exercised as cold and warm in the installed
Chrome engine (12 total). Cold here means a **fresh route navigation**,
not a fresh OS browser process; warm reuses the open page. Input selection
uses Chrome CDP setInputFiles, not the native file picker. Files were
downloaded through Android Chrome to /sdcard/Download and pulled with
ADB, then reopened separately on the host with pdf-lib or an independent
CSV record parser. PDF cases use 1/12/45 pages and verify 90-degree
rotation on the first page. CSV uses 100/5000/30000 data rows. No offsite
request or JavaScript page error was recorded in these twelve runs.

The two source JSON traces are immutable evidence snapshots:

- PDF 6 cases: str363-pdf-csv-1792492909619-raw.json,
  SHA-256 0aae949ed0c939cda638e2b40ee9ca2d8a7f83f03498dba308749c19a5208ae5.
- CSV 6 cases: str363-pdf-csv-1792493153889-raw.json,
  SHA-256 efe41942078d850c2935699cc214b4ec6cdf1a8f270a0db441361db7a3a502d5.

Compiled HTML SHA-256 for /tools/pdf-rotate/:
366f35bf6adf689e7dfae28349a76ea1286d77c2a8c9f25ee9e14b82b8546a2b.
Compiled HTML SHA-256 for /tools/csv-cleaner/:
b246457e568077a29e08ce6dbe3751d39eec23db1c1e45fef1a980baba220ba0.

Original input and Android-downloaded output binaries remain **preserved
only on MiniPC** under
/home/udodo/Code/.worktrees/str-363-capture-worker3/.tmp-str363-pdf-csv/.
The JSONs alone are not enough to repeat binary-level verification in a
new checkout; they expose byte lengths and hashes plus names/paths. The
independent parser
scripts/verify-mobile-memory-363-pdf-csv.mjs, executed on the same
MiniPC using those original files, checked 12/12 hash-bound pairs, verified
the compiled route digests and reopened PDFs/CSVs: zero discrepancies,
status PARTIAL_RAW_CROSSCHECKED_REVIEW_REQUIRED (exit 2, never PASS).

Memory values include CDP renderer JavaScript heap sampled before,
during and after operations, and Android dumpsys PSS/RSS of the **Chrome
main process only** before/after. The original dumpsys stdout and full
per-frame rAF intervals were not preserved in this first capture; the
independent checker therefore cannot independently recalculate those
memory/time measurements from a separate raw stream. Treat the recorded
PSS and rAF figures as instrumentation observations requiring manual
device/session review, not certified aggregate browser memory, OOM,
latency thresholds or frame performance. Browser automation adds jitter.

The harness initially failed on CSV because it assumed a form ancestor;
the later click was blocked by Chrome tab focus. Explicit foreground
selection and the correct file input were applied to the **test harness**.
The successful six CSV observations are from that corrected run; the six
earlier PDF records remain preserved unchanged. No application source
patch was needed.

**Still NOT_RUN:** cancel/background/retry, controlled resource-limit/OOM
preflight and result availability after background for every size/format;
native file picker; authentic iOS measurements; independent human
verification of live simulator acquisition. The six separate Android
image observations on another audit branch are also partial. Receipt
quality/receipts/mobile-memory-363-simulated.json keeps all 36 entries
NOT_RUN, physicalDeviceObserved=false. Issue #124 remains OPEN,
PR #380 DRAFT; no merge, deploy or physical-device claim.
