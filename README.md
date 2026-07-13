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

## CI/CD

Every pull request runs formatting, linting, type checking, tests (including the
Mongo integration suite), the production build, and a container smoke test.
Pushing an approved change to `main` runs the same checks, publishes an immutable
commit-tagged image to GHCR, and deploys it to `https://math.leaetzak.love`.

Production deployment uses a restricted SSH key that can only authenticate to
GHCR, request a Little Tables deployment, or read the service status. The VPS
pulls the exact commit image, checks `/health/ready`, and automatically restores
the previous image when the new release is unhealthy. Production application
secrets and the persistent Mongo volume remain on the VPS and are never copied
into GitHub or an image.

The normal development flow is:

```sh
git switch -c my-change
corepack pnpm install
corepack pnpm check
git push origin my-change
```

Open a pull request and merge it to deploy. A production redeploy of the current
`main` commit can also be started with **Run workflow** on the CI/CD workflow.

## Production image

The container serves the API and built PWA from one origin. Verify the complete
deployable image, including deep-link fallback routes, with:

```sh
corepack pnpm smoke:docker
```

Set `MONGODB_URI`, `MONGODB_DATABASE`, `INVITE_TOKEN`, `SESSION_SECRET`,
`VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` in production. Without MongoDB, the
server intentionally uses its in-memory repository for local development. The
daily reminder worker sends at 18:00 in each subscribed device's timezone and
skips the notification when practice was already completed that local day.

Invite links are single-use. Active sessions renew while the app syncs. If the
cookie is deliberately cleared, rotate `INVITE_TOKEN` to issue a new private
link; the previous token remains consumed in MongoDB.
