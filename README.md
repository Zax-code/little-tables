# little tables

An iPhone-first, offline-first multiplication practice PWA with Google-gated access.

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

Set `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `VAPID_PUBLIC_KEY`, and
`VAPID_PRIVATE_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_ALLOWED_EMAILS` in
production. Without MongoDB, the server intentionally uses its in-memory
repository for local development. The daily reminder worker sends at 18:00 in
each subscribed device's timezone and skips the notification when practice was
already completed that local day.

Production access requires a verified Google account from the configured
allowlist. Navigation without a valid Google-authenticated session redirects to
`/sign-in`, and protected API requests return `401`. After the server verifies a
Google session, the PWA remembers only its display name and real session expiry
so that local practice continues offline until that session expires. First-time,
expired, legacy, and server-rejected sessions remain locked.

## Google sign-in setup

Google sign-in uses a public OAuth 2.0 **Web client ID**, not a Google API key or
client secret. In Google Cloud Console, configure the OAuth consent screen,
create an OAuth client with application type **Web application**, and add these
authorized JavaScript origins:

- `https://math.leaetzak.love`
- `http://localhost:5173` for local development

Google's JavaScript popup/callback integration does not use a redirect URI. If
the Google Cloud Console requires one while creating the client, register:

- `https://math.leaetzak.love/`
- `http://localhost:5173/` for local development

Put the values in the server's environment:

```sh
GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
GOOGLE_ALLOWED_EMAILS=boomslang.a@gmail.com,belmudeslea@gmail.com
```

For production, add those two lines to
`/etc/little-tables/little-tables.env` on the VPS and restart the application (or
merge a deployment PR). For local development, export them in the shell that
runs `corepack pnpm dev:server`; `.env.example` documents the values but is not a
secret file to fill in or commit. `GOOGLE_ALLOWED_EMAILS` is a comma-separated
allowlist; production should contain only `boomslang.a@gmail.com` and
`belmudeslea@gmail.com`. The client ID is intentionally returned to the browser;
never add a Google client secret to the web app.
