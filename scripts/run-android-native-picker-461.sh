#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
export STR461_ADB="${STR461_ADB:-/opt/homebrew/bin/adb}"

if [[ ! -x "$STR461_ADB" ]]; then
  echo "STR461_NOT_RUN: Android SDK adb missing on Mac Studio: $STR461_ADB" >&2
  exit 2
fi
if [[ ! -f dist/tools/image-resize/index.html ]]; then
  echo "STR461_NOT_RUN: compiled consumer dist/tools/image-resize/index.html missing" >&2
  exit 2
fi
# Start an exclusive Android Emulator on the Studio in the permitted guarded
# night window before invoking this runner. This script never boots another AVD.
node scripts/acceptance-android-chrome-avd-461.mjs
