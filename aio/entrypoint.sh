#!/bin/sh
set -eu

# The backend lives in the same AIO container.
export BACKEND_HOST=127.0.0.1
export BACKEND_PORT=3000

# Start backend as the unprivileged node user.
su-exec node node /app/src/index.js &
backend_pid=$!

# Start upstream Caddy frontend and TLS configuration.
# mailflow-start handles TLS_MODE, certificates and Caddy.
 /usr/local/bin/mailflow-start &
caddy_pid=$!

shutdown() {
    trap - TERM INT
    kill -TERM "$caddy_pid" 2>/dev/null || true
    kill -TERM "$backend_pid" 2>/dev/null || true
    wait "$caddy_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
}

trap 'shutdown; exit 0' TERM INT

# Exit if either process stops unexpectedly.
while kill -0 "$backend_pid" 2>/dev/null &&
      kill -0 "$caddy_pid" 2>/dev/null; do
    sleep 2 &
    wait $! || true
done

shutdown
exit 1