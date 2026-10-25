# syntax=docker/dockerfile:1
# Build context: upstream MailFlow root, with custom aio/ files copied into it.
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
RUN apk add --no-cache nginx openssl su-exec \
    && sed -i \
      -e '/^[[:space:]]*gzip[[:space:]]/d' \
      -e '/^[[:space:]]*gzip_vary[[:space:]]/d' \
      -e '/^[[:space:]]*gzip_proxied[[:space:]]/d' \
      -e '/^[[:space:]]*gzip_comp_level[[:space:]]/d' \
      -e '/^[[:space:]]*gzip_min_length[[:space:]]/d' \
      -e '/^[[:space:]]*gzip_types[[:space:]]/d' \
      -e '/^[[:space:]]*ssl_session_cache[[:space:]]/d' \
      /etc/nginx/nginx.conf
WORKDIR /app
ARG BUILD_SHA
ARG APP_VERSION
ENV NODE_ENV=production PORT=3000 BUILD_SHA=${BUILD_SHA:-dev}
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN APP_VERSION_VALUE="${APP_VERSION:-$(node -p "require('./package.json').version")}"; \
    APP_VERSION_VALUE="${APP_VERSION_VALUE#v}"; \
    printf '{"version":"%s"}\n' "$APP_VERSION_VALUE" > /app/build-meta.json; \
    mkdir -p /var/cache/mailflow/images; \
    chown -R node:node /app /var/cache/mailflow
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
# Alpine's nginx package uses http.d, unlike the official nginx Docker image.
COPY frontend/nginx.conf /etc/nginx/http.d/default.conf
COPY frontend/generate-cert.sh /usr/local/bin/generate-cert.sh
COPY frontend/set-tls.sh /usr/local/bin/set-tls.sh
COPY aio/entrypoint.sh /usr/local/bin/aio-entrypoint.sh
RUN sed -i 's|^CONF=/etc/nginx/conf.d/default.conf|CONF=/etc/nginx/http.d/default.conf|' /usr/local/bin/set-tls.sh && \
    sed -i 's|server backend:3000 resolve; # mailflow-backend-managed|server 127.0.0.1:3000; # mailflow-backend-managed|' /etc/nginx/http.d/default.conf && \
    chmod +x /usr/local/bin/*.sh
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/key.pem \
      -out /etc/nginx/ssl/cert.pem \
      -days 1 \
      -subj "/CN=localhost" >/dev/null 2>&1 && \
    nginx -t && \
    rm -f /etc/nginx/ssl/cert.pem /etc/nginx/ssl/key.pem
EXPOSE 80 443
STOPSIGNAL SIGTERM
CMD ["/usr/local/bin/aio-entrypoint.sh"]
