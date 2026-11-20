# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.4-alpine AS dependencies
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS builder
WORKDIR /app

COPY . .
RUN export DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    DATABASE_URL_UNPOOLED=postgresql://build:build@127.0.0.1:5432/build \
    && bunx prisma generate \
    && bun run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# These are the only writable application paths in production. Named volumes
# preserve fallback chats, AI usage/cooldown state, and the Next.js image cache.
RUN mkdir -p .ai-gateway db/chat-logs .next/cache \
    && chown -R nextjs:nodejs .ai-gateway db .next/cache

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
