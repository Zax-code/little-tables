FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV CI=true
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/local-store/package.json packages/local-store/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm --filter @little-tables/server deploy --prod --legacy /prod/server

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV WEB_DIST_PATH=/app/web-dist

COPY --from=build --chown=node:node /prod/server ./
COPY --from=build --chown=node:node /app/apps/web/dist ./web-dist

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

USER node
CMD ["node", "dist/main.js"]
