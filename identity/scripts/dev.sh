#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Ensure the directory nginx serves exists before the server starts.
mkdir -p "$ROOT/dist"

# Watch both the demo app and the library in the background.
# `--watch=forever` keeps esbuild watching even though the background jobs'
# stdin is /dev/null (a plain `--watch` would exit immediately).
# Each watcher runs in its own session (setsid) so the whole process tree can
# be torn down cleanly on exit.
setsid npm run build:app -- --watch=forever &
app_pid=$!
setsid npm run build:lib -- --watch=forever &
lib_pid=$!

# Stop the watchers (and their children) when this script exits (e.g. Ctrl+C).
cleanup() {
  kill -INT -- -"$app_pid" 2>/dev/null || true
  kill -INT -- -"$lib_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  wait "$lib_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Run the nginx server in the foreground.
npm run serve
