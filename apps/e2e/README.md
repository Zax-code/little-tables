# End-to-end tests

Agentic end-to-end tests of the PWA with [e2e](https://e2e.tester.army) by TesterArmy. A test mixes
exact steps (`screen`, `expect`) with goals in natural language (`agent.act`, `agent.assert`);
verified goals are replayed from `.e2e/cache/` without calling the model again.

## Running

e2e needs Node 24.8 or newer (or 22.22.3 on Node 22). `scripts/e2e.sh` switches to the Node of
`apps/e2e/.nvmrc` through nvm when the current one is older (`nvm install 24` once).

```sh
corepack pnpm e2e:login                             # once: sign in with ChatGPT Plus or Pro
corepack pnpm e2e                                   # run every test in apps/e2e/tests
corepack pnpm e2e --headed                          # watch the browser
corepack pnpm --filter @little-tables/e2e explore 'add a second child'
```

`scripts/serve.sh` serves the stack on a free port for each run: it rebuilds the WebAssembly engine
and the app, then starts the Rust server with `AUTH_MODE=disabled` on a fresh database in
`.e2e/server/`. It never touches `pnpm dev`, `pnpm dev:server` or `little-tables.db`. Its output
goes to `.e2e/logs/app.log`.

Without Google sign-in the server knows one family, so tests that build on each other belong to a
`describe(..., { serial: true })` group. The browser runs in French (`fr-FR`).

Reports, traces and failure screens land in `.e2e/` (ignored by Git); `.e2e/report.json` sums up
the last run. The suite runs locally only: a ChatGPT login cannot serve CI.

## Writing tests

Files are `tests/*.e2e.ts`. The e2e skill (`.agents/skills/e2e/`, linked from
`.claude/skills/e2e`) documents the API for coding agents; `npx e2e guide` prints it too.
