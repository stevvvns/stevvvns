#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT/certs"
CERT="$CERT_DIR/cert.pem"
KEY="$CERT_DIR/key.pem"
PORT="${SERVE_PORT:-9443}"

# Generate a self-signed certificate on first run (kept out of version control).
if [[ ! -f "$CERT" || ! -f "$KEY" ]]; then
  echo "Generating self-signed certificate..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" \
    -out "$CERT" \
    -days 365 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

if [[ ! -d "$ROOT/dist" ]]; then
  echo "dist/ not found — run 'npm run build' first." >&2
  exit 1
fi

echo "Serving https://localhost:${PORT} (Ctrl+C to stop)"

# Clear any container left over from a previous unclean shutdown so the
# fixed name doesn't collide.
docker rm -f identity-serve >/dev/null 2>&1 || true

docker run --rm --name identity-serve \
  -p "${PORT}:443" \
  -v "$ROOT/dist:/usr/share/nginx/html:ro" \
  -v "$ROOT/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$ROOT/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$CERT_DIR:/etc/nginx/certs:ro" \
  nginx:alpine
