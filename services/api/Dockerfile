# Construir desde la raíz del monorepo:
#   docker build -f services/api/Dockerfile -t api .
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.22.0
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@storynido/api..."
RUN pnpm turbo run build --filter=@storynido/api
RUN pnpm --filter=@storynido/api deploy --prod --legacy /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/services/api/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
