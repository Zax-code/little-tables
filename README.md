# little tables

An iPhone-first, offline-first mathematics practice PWA with Google-gated access:
multiplication tables, inverse division, and French CE2 activities for fractions,
addition, and subtraction with three-digit numbers.

The approved product and architecture specification is in [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md).

The CE2 curriculum, interaction, and compatibility specification is in
[CE2_MATH_EXPANSION_SPEC.md](./CE2_MATH_EXPANSION_SPEC.md).

## Development

```sh
corepack pnpm install
corepack pnpm dev
```

Run all verification with:

```sh
corepack pnpm check
```

Run the React static audit with:

```sh
corepack pnpm doctor
```

The development web app also enables React Scan and TanStack Router Devtools. Both tools are
excluded from production builds.

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

Rootful Podman Quadlets own the application, MongoDB, and the existing named
Mongo volume. The active app Quadlet records the exact immutable image tag;
ordinary releases restart only the application. The one-time migration and
rollback procedure is documented in
[`deploy/QUADLET_RUNBOOK.md`](./deploy/QUADLET_RUNBOOK.md).

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

Set `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `GOOGLE_CLIENT_ID` in production.
`GOOGLE_ALLOWED_EMAILS` is optional. Without MongoDB, the server intentionally
uses its in-memory repository for local development. The daily reminder worker
sends at 18:00 in each subscribed device's timezone and skips the notification
when practice was already completed that local day.

Production access requires a verified Google account from the configured or
Mongo-backed allowlist. The owner account, `boomslang.a@gmail.com`, can open
**manage who can join** from the home screen to add an address; the link and
management screen are hidden from other users, and the server rejects their
management requests with `403`. Navigation without a valid Google-authenticated
session redirects to `/sign-in`, and protected API requests return `401`. After
the server verifies a Google session, the PWA remembers only its display name,
server-verified profile ID, and real session expiry so that local practice
continues offline until that session expires. First-time, expired, legacy, and server-rejected sessions
remain locked. Deploying the owner-managed allowlist changes the signed session
payload, so existing users will be asked to sign in once after rollout.

The pre-family-profile release had one deployment-level learner identity, `lou`; configured Google
emails were access gates to that shared learner rather than separate data owners. During the
family-profile backfill, only the owner account retains `lou` and its practice history. Legacy
preference records for other Google subjects receive new isolated family member IDs and do not inherit the
ambiguous shared history or device outbox.

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
GOOGLE_ALLOWED_EMAILS=boomslang.a@gmail.com,belmudeslea@gmail.com,zh.wener@gmail.com
```

For production, add those two lines to
`/etc/little-tables/little-tables.env` on the VPS and restart the application (or
merge a deployment PR). For local development, export them in the shell that
runs `corepack pnpm dev:server`; `.env.example` documents the values but is not a
secret file to fill in or commit. `GOOGLE_ALLOWED_EMAILS` is a comma-separated
bootstrap allowlist for addresses managed through deployment configuration.
Addresses added through the owner screen are normalized and stored in MongoDB,
so they survive deployments without changing the environment file. The client
ID is intentionally returned to the browser; never add a Google client secret
to the web app.
