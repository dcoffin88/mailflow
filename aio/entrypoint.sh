#!/bin/sh
set -eu

# Configure TLS and validate Nginx.
 /usr/local/bin/generate-cert.sh
 /usr/local/bin/set-tls.sh
nginx -t

# Start backend as the unprivileged node user.
su-exec node node /app/src/index.js &
backend_pid=$!

# Start Nginx.
nginx -g 'daemon off;' &
nginx_pid=$!

shutdown() {
    trap - TERM INT
    kill -TERM "$backend_pid" 2>/dev/null || true
    kill -QUIT "$nginx_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
    wait "$nginx_pid" 2>/dev/null || true
}

trap 'shutdown; exit 0' TERM INT

# Exit if either process stops unexpectedly.
while kill -0 "$backend_pid" 2>/dev/null &&
      kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 2 &
    wait $! || true
done

shutdown
exit 1