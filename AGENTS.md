# Repository Guidelines

## Project Structure & Module Organization

This pnpm workspace contains two applications and two shared packages:

- `apps/web/`: React/Vite PWA with screens, reusable components, and `src/sw.ts`.
- `apps/server/`: Effect-based Node API, authentication, Mongo repositories, and daily Web Push reminders.
- `packages/domain/`: multiplication learning engine and reward logic.
- `packages/local-store/`: Dexie offline state and sync outbox.
- `apps/web/public/`: PWA icons, screenshots, and generated artwork.
- `deploy/`: Caddy and systemd templates plus restricted, health-checked deployment scripts.
- `.github/workflows/pipeline.yml`: CI, GHCR image publishing, and production deployment.

Keep tests beside their implementation as `*.test.ts`. Do not edit generated `dist/` output.

## Build, Test, and Development Commands

Use Node 22 or newer and the pinned pnpm version.

```sh
corepack pnpm install        # install the workspace from pnpm-lock.yaml
corepack pnpm dev            # start the web app on port 5173
corepack pnpm dev:server     # start the API on port 3000
corepack pnpm check          # format, lint, typecheck, test, and build
corepack pnpm build          # create all production bundles
corepack pnpm smoke:docker   # build and probe the production container
```

The full test suite requires a Docker-compatible runtime for the Mongo Testcontainers test.

## Coding Style & Naming Conventions

TypeScript is strict and ESM-only. Prettier and ESLint enforce formatting, React hooks, and TypeScript rules. Use two-space indentation, single quotes, trailing commas, and `.js` extensions in relative imports. Name components in PascalCase, variables in camelCase, and files in kebab-case. Prefer readonly inputs and explicit HTTP schemas.

## Testing Guidelines

Vitest is used throughout, with Fast Check for domain properties and Testcontainers for Mongo integration. Add focused tests for behavior changes, especially learning rules, persistence, sync, authentication, scheduling, and service-worker logic. Run `corepack pnpm check` before pushing; CI repeats it from a clean checkout.

## Commit & Pull Request Guidelines

History follows Conventional Commit-style subjects such as `feat:`, `fix:`, and `build:`. Keep commits scoped and imperative. Pull requests should explain user impact, list verification performed, link relevant issues, and include screenshots for visible PWA changes. All CI checks must pass before merge. Merging to `main` deploys production automatically.

## Security & Deployment

Never commit `.env` files, invite tokens, VAPID private keys, session secrets, registry credentials, or SSH keys. Production secrets remain under `/etc/little-tables/` on the VPS. Deployments use immutable GHCR tags, a command-restricted SSH key, health checks, and automatic rollback; preserve these controls when changing deployment files.
