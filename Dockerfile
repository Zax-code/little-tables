FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/local-store/package.json packages/local-store/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_PATH=/app/apps/web/dist
EXPOSE 3000

USER node
CMD ["node", "apps/server/dist/main.js"]
