#!/usr/bin/env bash
# Local setup only; never modifies remote repository settings or worktrees.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
if [ "$(git -C "$ROOT" rev-parse --show-toplevel)" != "$ROOT" ]; then
  echo 'BLOCKED: not the canonical Strumentini Git checkout' >&2
  exit 2
fi
installed="$(git -C "$ROOT" config --get core.hooksPath || true)"
if [ -n "$installed" ] && [ "$installed" != '.githooks' ]; then
  echo 'BLOCKED: another effective Git hooksPath (including system/global) is active; preserve its owner and reconcile hooks' >&2
  exit 3
fi
if [ -z "$installed" ]; then
  # Git's standard hooks path is authoritative until we explicitly change it.
  # Detect executable, non-sample hooks from an existing owner before moving
  # *all* hook dispatch to .githooks. This also supports linked worktrees.
  default_hooks="$(git -C "$ROOT" rev-parse --path-format=absolute --git-path hooks)"
  for hook in "$default_hooks"/*; do
    case "$hook" in *.sample) continue ;; esac
    if [ -f "$hook" ] && [ -x "$hook" ]; then
      echo 'BLOCKED: existing executable Git hook would be bypassed; reconcile/chaining required' >&2
      exit 3
    fi
  done
fi
if [ ! -f "$ROOT/.githooks/pre-push" ]; then
  echo 'BLOCKED: the owner-reviewed pre-push hook is missing' >&2
  exit 4
fi
chmod +x "$ROOT/.githooks/pre-push"
git -C "$ROOT" config --local core.hooksPath .githooks
test "$(git -C "$ROOT" config --local --get core.hooksPath)" = '.githooks'
printf 'PUBLIC_PR_GIT_HOOK_INSTALLED: core.hooksPath=.githooks (local defense only)\n'
