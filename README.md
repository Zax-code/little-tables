# little tables

An iPhone-first, offline-capable multiplication practice PWA.

The approved product and architecture specification is in [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md).

## Development

```sh
corepack pnpm install
corepack pnpm dev
```

Run all verification with:

```sh
corepack pnpm check
```

The web app runs on port 5173 and proxies `/api` to the Effect server on port 3000. Start the server in another terminal with `corepack pnpm dev:server`.

## Production image

The container serves the API and built PWA from one origin. Verify the complete
deployable image, including deep-link fallback routes, with:

```sh
corepack pnpm smoke:docker
```

Set `MONGODB_URI`, `MONGODB_DATABASE`, `INVITE_TOKEN`, and `SESSION_SECRET` in
production. Without MongoDB, the server intentionally uses its in-memory
repository for local development.
