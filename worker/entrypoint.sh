#!/bin/sh
set -e

# Start dockerd in background (DinD)
dockerd-entrypoint.sh &
DOCKERD_PID=$!

echo "[entrypoint] waiting for dockerd to be ready..."
RETRIES=30
until docker info >/dev/null 2>&1; do
  sleep 1
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "[entrypoint] ERROR: dockerd did not start in time"
    exit 1
  fi
done
echo "[entrypoint] dockerd is ready"

# Initialize a persistent buildx builder for reuse (best-effort)
docker buildx inspect rayflow-worker-builder >/dev/null 2>&1 || \
  docker buildx create --name rayflow-worker-builder --driver docker-container --use 2>/dev/null || true

echo "[entrypoint] starting rayflow-worker HTTP server"
exec /app/worker
