# Construir desde la raíz del monorepo:
#   docker build -f services/worker/Dockerfile -t worker .
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.22.0
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@storynido/worker..."
RUN pnpm turbo run build --filter=@storynido/worker
RUN pnpm --filter=@storynido/worker deploy --prod --legacy /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
# Chromium para maquetar los PDF del libro (las tipografías van embebidas en el HTML).
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/services/worker/dist ./dist
USER node
EXPOSE 8081
CMD ["node", "dist/server.mjs"]
