#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Ensure the directory the dev server serves exists.
mkdir -p "$ROOT/dist"

# Run the library watcher in the background (in its own session so it can be
# torn down cleanly), and the app watcher in the foreground. Ctrl+C reaches the
# foreground watcher directly; once it exits, the EXIT trap kills the other.
setsid npm run watch:lib &
lib_pid=$!
trap 'kill -INT -- -"$lib_pid" 2>/dev/null || true' EXIT

npm run watch:app
