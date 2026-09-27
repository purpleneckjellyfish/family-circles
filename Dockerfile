# Family Circles — production image (Unraid / Docker Compose)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data /app/scripts \
  && chown -R node:node /data /app

# Production server (Next standalone)
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Migrations (drizzle-orm migrator — no drizzle-kit in the image)
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=node:node /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Ensure migrate.mjs can resolve runtime deps even if standalone tracing missed them
COPY --from=deps --chown=node:node /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=node:node /app/node_modules/postgres ./node_modules/postgres

RUN chmod +x /app/scripts/docker-entrypoint.sh

USER node
EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
