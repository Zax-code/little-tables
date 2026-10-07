# Repository Guidelines

## Project Structure & Module Organization

A Rust workspace (`crates/`) and a pnpm workspace:

- `crates/lt-domain/`: the learning engine (bit-exact golden vectors, property tests); `lt-domain-wasm` compiles it for the browser.
- `crates/lt-server/`: the axum server, `/api/v2`, Google sessions, daily Web Push reminders and admin commands; `lt-store` (SQLite), `lt-auth` and `lt-push` support it.
- `apps/app/`: the React/Vite PWA (screens, offline data, sync, `src/sw.ts`); `apps/app/public/` holds icons, manifests, screenshots and character artwork.
- `apps/e2e/`: agentic end-to-end tests with e2e (tester.army) against the built app and the server without sign-in; see its README.
- `packages/engine/`, `packages/api-contract/`, `packages/ui/`: the engine facade, the `/api/v2` client and the design system.
- `tools/golden/`: the frozen TypeScript engine that produced the golden vectors; `assets/`: artwork sources.
- `deploy/`: the systemd release units, deployment and backup scripts, Caddy fragments, the pre-production setup, and the Quadlets production runs until the switch.
- `.github/workflows/pipeline.yml`: CI, release archives and (paused) production deployment.

Keep tests beside their implementation as `*.test.ts`. Do not edit generated `dist/` output.

## Build, Test, and Development Commands

Use Node 22 or newer and the pinned pnpm version.

```sh
corepack pnpm install        # install the workspace from pnpm-lock.yaml
corepack pnpm dev            # start the app on port 5173
corepack pnpm dev:server     # start the Rust server on port 3000, without Google sign-in
corepack pnpm check          # format, lint, typecheck, Rust and TypeScript tests, and build
corepack pnpm doctor         # run the full React Doctor audit for the app
corepack pnpm build          # create all production bundles
corepack pnpm e2e            # run the end-to-end tests (Node 24, ChatGPT login; see apps/e2e)
corepack pnpm smoke:release  # probe a release archive: tools/smoke-release.sh <archive> <commit>
```

Rust needs the `wasm32-unknown-unknown` target, `wasm-bindgen` 0.2.129 and `wasm-opt`. For
every feature or fix, run both `corepack pnpm check` and `corepack pnpm doctor` before pushing, and
resolve any new React Doctor findings.

## Coding Style & Naming Conventions

TypeScript is strict and ESM-only. Prettier and ESLint enforce formatting, React hooks, and TypeScript rules. Use two-space indentation, single quotes, trailing commas, and `.js` extensions in relative imports. Name components in PascalCase, variables in camelCase, and files in kebab-case. Prefer readonly inputs and explicit HTTP schemas.

## Testing Guidelines

Vitest covers the TypeScript packages and the app (happy-dom, fake IndexedDB, the real WebAssembly engine); `cargo test` covers the crates, with proptest for engine properties and recorded responses for the `/api/v2` contract. Add focused tests for behavior changes, especially learning rules, persistence, sync, authentication, scheduling, and service-worker logic. Run `corepack pnpm check` before pushing; CI repeats it from a clean checkout.

## Commit & Pull Request Guidelines

History follows Conventional Commit-style subjects such as `feat:`, `fix:`, and `build:`. Keep commits scoped and imperative. Pull requests should explain user impact, list verification performed, link relevant issues, and include screenshots for visible PWA changes. All CI checks must pass before merge. Merging to `main` deploys production only when the repository variable `DEPLOY_ON_MERGE` is `true`; it is paused during the rewrite.

When finishing any feature or fix, always commit and push the completed work on a branch and open a pull request. Do not stop with uncommitted local changes.

## Security & Deployment

Never commit `.env` files, invite tokens, VAPID private keys, session secrets, registry credentials, or SSH keys. Production secrets remain under `/etc/little-tables/` on the VPS. Deployments use immutable release archives checked by SHA-256, a command-restricted SSH key, pre-deploy backups, health checks, and automatic rollback; preserve these controls when changing deployment files.
