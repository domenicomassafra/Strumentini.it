#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
export STR461_ADB="$repo_dir/scripts/str461-remote-adb.py"

# CDP: Studio:19222 -> MiniPC:19222 -> AVD Chrome.
# Site: AVD:18875 -> MiniPC:18875 -> Studio:18875 (compiled dist).
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=10 \
  -N -L 19222:127.0.0.1:19222 -R 18875:127.0.0.1:18875 minipc &
tunnel_pid=$!
trap 'kill "$tunnel_pid" 2>/dev/null || true' EXIT

sleep 1
kill -0 "$tunnel_pid"
node scripts/acceptance-android-chrome-avd-461.mjs
