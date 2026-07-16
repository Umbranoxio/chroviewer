# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.3.14
ARG NODE_VERSION=24.15.0
ARG BUILD_CACHE_SCOPE=shared

FROM oven/bun:${BUN_VERSION}-alpine AS deps

WORKDIR /app

ARG BUILD_CACHE_SCOPE

COPY package.json bun.lock ./
RUN --mount=type=cache,id=chroviewer-${BUILD_CACHE_SCOPE}-bun,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile --ignore-scripts

FROM deps AS builder

WORKDIR /app

COPY . .

ARG BUILD_CACHE_SCOPE
ARG VITE_BEATSAVER_API_URL=https://api.beatsaver.com
ARG VITE_SCORESABER_API_URL=https://scoresaber.com
ARG VITE_LUDUS_URL=https://ludus-1.scoresaber.com

ENV NODE_ENV=production \
    VITE_BEATSAVER_API_URL=${VITE_BEATSAVER_API_URL} \
    VITE_SCORESABER_API_URL=${VITE_SCORESABER_API_URL} \
    VITE_LUDUS_URL=${VITE_LUDUS_URL}

RUN --mount=type=cache,id=chroviewer-${BUILD_CACHE_SCOPE}-vite,target=/app/node_modules/.vite,sharing=locked \
    bun run build

FROM node:${NODE_VERSION}-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000

COPY --from=builder --chown=node:node /app/.output ./.output

USER node

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4000') + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
