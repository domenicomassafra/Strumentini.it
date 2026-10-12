#!/usr/bin/env bash
# Local setup only; never modifies remote repository settings or worktrees.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
if [ "$(git -C "$ROOT" rev-parse --show-toplevel)" != "$ROOT" ]; then
  echo 'BLOCKED: not the canonical Strumentini Git checkout' >&2
  exit 2
fi
installed="$(git -C "$ROOT" config --local --get core.hooksPath || true)"
if [ -n "$installed" ] && [ "$installed" != '.githooks' ]; then
  echo 'BLOCKED: another Git hooksPath is active; preserve its owner and reconcile hooks' >&2
  exit 3
fi
if [ ! -f "$ROOT/.githooks/pre-push" ]; then
  echo 'BLOCKED: the owner-reviewed pre-push hook is missing' >&2
  exit 4
fi
chmod +x "$ROOT/.githooks/pre-push"
git -C "$ROOT" config --local core.hooksPath .githooks
test "$(git -C "$ROOT" config --local --get core.hooksPath)" = '.githooks'
printf 'PUBLIC_PR_GIT_HOOK_INSTALLED: core.hooksPath=.githooks (local defense only)\n'
