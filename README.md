# little tables

An iPhone-first, offline-first PWA where children practise multiplication tables, then additions,
big numbers and fractions, while a garden grows. Families sign in with Google; access is by
invitation.

The architecture and its decisions are in
[`docs/rewrite/TECHNICAL_SPEC.md`](./docs/rewrite/TECHNICAL_SPEC.md).

| Part                    | What it is                                                                      |
| ----------------------- | ------------------------------------------------------------------------------- |
| `crates/lt-domain`      | The learning engine in Rust, also compiled to WebAssembly for the app           |
| `crates/lt-server`      | The server: `/api/v2`, Google sessions, daily reminders, SQLite, admin commands |
| `apps/app`              | The PWA: React, TanStack Router and Query, Effect, IndexedDB                    |
| `packages/engine`       | Effect facade of the WebAssembly engine                                         |
| `packages/api-contract` | Effect schemas and client of `/api/v2`                                          |
| `packages/ui`           | The design system (Ladle stories)                                               |

## Development

Node 22 or newer, the pinned pnpm, Rust stable with the `wasm32-unknown-unknown` target,
`wasm-bindgen` 0.2.129 and `wasm-opt`.

```sh
corepack pnpm install
corepack pnpm dev:server   # the server on port 3000, without Google sign-in
corepack pnpm dev          # the app on port 5173, proxying /api to the server
```

Run all verification (format, lint, types, Rust and TypeScript tests, build) and the React audit:

```sh
corepack pnpm check
corepack pnpm doctor
```

## Releases and deployment

Every CI run builds one archive per commit, the server binary and the app in `web/`, smoke-tests
it and keeps it as an artifact for 30 days. Production runs it as an immutable systemd release:
`/opt/little-tables/releases/<commit>`, an atomic `current` link, state in
`/var/lib/little-tables/` (SQLite and nightly backups) and secrets in `/etc/little-tables/`.
The restricted deployment key can only send a release (`deploy-release <commit> <sha256>`), read
the service status or check public health; the VPS verifies the checksum, backs up, migrates,
switches and rolls back if the new release is unhealthy.

**Current state.** Production runs the Rust server and deploys on merge (repository variable
`DEPLOY_ON_MERGE`). The previous Node server, its MongoDB and their Quadlets are retired; the
switch is recorded in [`deploy/RUST_CUTOVER_RUNBOOK.md`](./deploy/RUST_CUTOVER_RUNBOOK.md).
Pre-production (`https://math-preprod.leaetzak.love`, see [`deploy/preprod/`](./deploy/preprod/))
can run a release beside production.

`.env.example` lists the server's variables. Production refuses to start without
`SESSION_SECRET`, `GOOGLE_CLIENT_ID`, the VAPID keys, `ADMIN_EMAILS` and `PUBLIC_ORIGIN`.

## Google sign-in setup

Google sign-in uses a public OAuth 2.0 **Web client ID**, never a client secret. The OAuth client
(application type **Web application**) lists these authorized JavaScript origins:

- `https://math.leaetzak.love`
- `https://math-preprod.leaetzak.love`
- `http://localhost:5173` for local development

`GOOGLE_CLIENT_ID` and the optional `GOOGLE_ALLOWED_EMAILS` (a comma-separated starting allowlist)
go in the server's environment file. Administrators (`ADMIN_EMAILS`) add or remove addresses in
the app's parent space; those are stored in the database and revoke existing sessions when removed.
