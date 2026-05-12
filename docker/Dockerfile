FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
ARG DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/postgres
ENV DATABASE_URL=$DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs drizzle.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker/entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
