# syntax=docker/dockerfile:1
# Build context: upstream MailFlow root with custom aio/ files.
FROM node:22-alpine AS backend-deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci
COPY frontend/ ./
ARG BUILD_SHA
ENV VITE_BUILD_SHA=${BUILD_SHA:-dev}
ARG VITE_EMAIL_DIV_RENDER=false
ENV VITE_EMAIL_DIV_RENDER=${VITE_EMAIL_DIV_RENDER}
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache caddy openssl su-exec \
    && mkdir -p /etc/caddy /etc/mailflow/certs /srv \
       /var/cache/mailflow/images /data/caddy /config/caddy
WORKDIR /app
ARG BUILD_SHA
ARG APP_VERSION
ENV NODE_ENV=production \
    PORT=3000 \
    BUILD_SHA=${BUILD_SHA:-dev} \
    BACKEND_HOST=127.0.0.1 \
    BACKEND_PORT=3000 \
    XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/config
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN APP_VERSION_VALUE="${APP_VERSION:-$(node -p "require('./package.json').version")}"; \
    APP_VERSION_VALUE="${APP_VERSION_VALUE#v}"; \
    printf '{"version":"%s"}\n' "$APP_VERSION_VALUE" > /app/build-meta.json; \
    chown -R node:node /app /var/cache/mailflow
COPY --from=frontend-builder /app/dist /srv

# Use upstream's Caddy configurations without modifying them.
COPY frontend/caddy/Caddyfile frontend/caddy/sites-*.caddy /etc/caddy/
COPY frontend/caddy/start.sh /usr/local/bin/mailflow-start
# Custom AIO process supervisor.
COPY aio/entrypoint.sh /usr/local/bin/aio-entrypoint.sh
RUN chmod +x /usr/local/bin/mailflow-start \
    /usr/local/bin/aio-entrypoint.sh
EXPOSE 80 443 443/udp
STOPSIGNAL SIGTERM
CMD ["/usr/local/bin/aio-entrypoint.sh"]
