# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.






# Alerting Bot

Schedule-driven alerts over Olvid and email.

Alerting Bot watches external sources (polling URLs, RSS/JSON/XML feeds, HTTP monitors, inbound webhooks), evaluates user-defined conditions on the payloads, and dispatches formatted messages through Olvid discussions or SMTP. Alerts are managed from a web UI. A one-minute heartbeat inside the app runs every scheduled check.

## Architecture

Three services, orchestrated by Docker Compose:

| Service     | Image / build            | Role                                                              |
| ----------- | ------------------------ | ----------------------------------------------------------------- |
| `nuxt_app`  | built from `Dockerfile`  | Nuxt 4 web app — UI, HTTP API, and the `polling:heartbeat` task.  |
| `daemon`    | `olvid/bot-daemon:2.0.1` | Olvid bot daemon. gRPC on `:50051` (internal to the compose net). |
| `cli`       | `olvid/bot-python-runner:2.0.1` | Olvid pairing CLI. Interactive; only used to pair an identity. |

Data is stored in SQLite (via Prisma). The DB file lives on the host (bind-mount) so it survives container recreation.

## Prerequisites

- Docker Desktop, or Docker Engine + Compose v2.
- An Olvid identity (mobile app or otherwise) to pair with the daemon on first boot.

## Quickstart

```bash
cp .env.example .env
# edit .env — see "Environment variables" below

# 1. Start the daemon first — nuxt_app waits for its healthcheck.
docker compose up -d daemon

# 2. Pair an Olvid identity (only needed the first time).
docker compose run --rm cli

# 3. Start the app.
docker compose up -d nuxt_app
```

Open http://localhost:3000. Create an alert, add a bundle, activate it.

The order matters: `nuxt_app` declares `depends_on: { daemon: { condition: service_healthy } }` and will not start until the daemon is reachable.

## Environment variables

All variables come from a project-root `.env` file which is git-ignored; `.env.example` documents the expected keys.

| Variable                    | Purpose                                         | Example                                       |
| --------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`              | SQLite file path. Must start with `file:`.      | `file:/data/alerting.db` (compose) · `file:./dev.db` (local dev) |
| `OLVID_DAEMON_URL`          | gRPC endpoint of the daemon.                    | `http://daemon:50051` (compose) · `http://localhost:50052` (local dev) |
| `OLVID_CLIENT_KEY`          | Client key issued during CLI pairing.           | `34f52581-a6b7-…`                             |
| `OLVID_ADMIN_CLIENT_KEY_CLI`| Bootstrap key consumed by the `cli` service.    | `8942311-9b8c-…`                              |
| `SMTP_HOST`                 | SMTP server for mail-output bundles.            | `smtp.mailpace.com`                           |
| `SMTP_PORT`                 | SMTP port.                                      | `587`                                         |
| `SMTP_USER`                 | SMTP username (MailPace: domain SMTP token).    | *(from provider)*                             |
| `SMTP_PASSWORD`             | SMTP password (MailPace: same as user).         | *(from provider)*                             |
# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.








# Alerting Bot

Schedule-driven alerts over Olvid and email.

Alerting Bot watches external sources (polling URLs, RSS/JSON/XML feeds, HTTP monitors, inbound webhooks), evaluates user-defined conditions on the payloads, and dispatches formatted messages through Olvid discussions or SMTP. Alerts are managed from a web UI. A one-minute heartbeat inside the app runs every scheduled check.

## Architecture

Three services, orchestrated by Docker Compose:

| Service     | Image / build            | Role                                                              |
| ----------- | ------------------------ | ----------------------------------------------------------------- |
| `nuxt_app`  | built from `Dockerfile`  | Nuxt 4 web app — UI, HTTP API, and the `polling:heartbeat` task.  |
| `daemon`    | `olvid/bot-daemon:2.0.1` | Olvid bot daemon. gRPC on `:50051` (internal to the compose net). |
| `cli`       | `olvid/bot-python-runner:2.0.1` | Olvid pairing CLI. Interactive; only used to pair an identity. |

Data is stored in SQLite (via Prisma). The DB file lives on the host (bind-mount) so it survives container recreation.

## Prerequisites

- Docker Desktop, or Docker Engine + Compose v2.
- An Olvid identity (mobile app or otherwise) to pair with the daemon on first boot.

## Quickstart

```bash
cp .env.example .env
# edit .env — see "Environment variables" below

# 1. Start the daemon first — nuxt_app waits for its healthcheck.
docker compose up -d daemon

# 2. Pair an Olvid identity (only needed the first time).
docker compose run --rm cli

# 3. Start the app.
docker compose up -d nuxt_app
```

Open http://localhost:3000. Create an alert, add a bundle, activate it.

The order matters: `nuxt_app` declares `depends_on: { daemon: { condition: service_healthy } }` and will not start until the daemon is reachable.

## Environment variables

All variables come from a project-root `.env` file which is git-ignored; `.env.example` documents the expected keys.

| Variable                    | Purpose                                         | Example                                       |
| --------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`              | SQLite file path. Must start with `file:`.      | `file:/data/alerting.db` (compose) · `file:./dev.db` (local dev) |
| `OLVID_DAEMON_URL`          | gRPC endpoint of the daemon.                    | `http://daemon:50051` (compose) · `http://localhost:50052` (local dev) |
| `OLVID_CLIENT_KEY`          | Client key issued during CLI pairing.           | `34f52581-a6b7-…`                             |
| `OLVID_ADMIN_CLIENT_KEY_CLI`| Bootstrap key consumed by the `cli` service.    | `8942311-9b8c-…`                              |
| `SMTP_HOST`                 | SMTP server for mail-output bundles.            | `smtp.mailpace.com`                           |
| `SMTP_PORT`                 | SMTP port.                                      | `587`                                         |
| `SMTP_USER`                 | SMTP username (MailPace: domain SMTP token).    | *(from provider)*                             |
| `SMTP_PASSWORD`             | SMTP password (MailPace: same as user).         | *(from provider)*                             |
| `SMTP_FROM`                 | `From:` header — must be a verified sender.     | `Alerting Bot <alerts@your-domain.tld>`       |

**Postgres warning.** The app checks `DATABASE_URL` at boot and refuses anything that does not start with `file:`. If your shell has `DATABASE_URL` exported to a Postgres URL from an unrelated project, unset it before running the app (`Remove-Item Env:DATABASE_URL` on PowerShell, `unset DATABASE_URL` on bash) so the `.env` value takes effect.

## Where the database lives

### Production / Docker Compose

The SQLite file is at `./data/alerting.db` on the host, bind-mounted to `/data` inside the `nuxt_app` container. The `./data/` folder is git-ignored and is created empty on first boot; Prisma creates the schema the first time the container starts (via `prisma db push` in the Dockerfile's `CMD`).

Because the file lives on the host filesystem, it survives `docker compose down` and `docker compose up` freely. To reset the database, stop the stack and delete `./data/alerting.db*`.

### Local development (`npm run dev`)

The SQLite file lives at the project root: `./dev.db`. During writes, SQLite may create auxiliary files next to it:

```
dev.db
dev.db-journal
dev.db-wal
dev.db-shm
```

All four are in `.gitignore` — never commit any of them. Set `DATABASE_URL=file:./dev.db` in your `.env`.

The path resolution is anchored to the project root (see `server/db/prisma.ts`), so it works whether you run from the project root or from inside `.nuxt/dev/…`.

## Persistence options

Pick one based on whether you want to inspect the DB file directly from the host.

1. **Bind-mount (default).** `./data:/data` in `docker-compose.yaml`. You can inspect the file directly (`sqlite3 ./data/alerting.db`), back it up with `cp`, or reset with `rm`. This is what the shipped compose file uses.
2. **Named Docker volume.** Replace `./data:/data` with `alerting_data:/data` and add:
   ```yaml
   volumes:
     alerting_data:
   ```
   at the top level of the compose file. More portable (no host path leak into the compose file), but inspecting the DB now requires `docker compose exec nuxt_app sh` or `docker cp`.
3. **Local file, no Docker (dev only).** `DATABASE_URL=file:./dev.db`, run `npm run dev` outside of Docker. The daemon still runs in a container.

## Local development without Docker

For iterating on the code with HMR:

```bash
npm install
cp .env.example .env
# in .env, set:
#   DATABASE_URL=file:./dev.db
#   OLVID_DAEMON_URL=http://localhost:50052

# The daemon still needs to be up (in a container is fine).
docker compose up -d daemon

npm run dev
```

Nuxt serves at http://localhost:3000. Server-side changes under `server/` restart Nitro automatically.

## Common operations

| Task                                        | Command                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| Follow app logs                             | `docker compose logs -f nuxt_app`                          |
| Rebuild the image after a dep change        | `docker compose build --no-cache nuxt_app`                 |
| Reset the DB (dev)                          | Stop, `rm ./data/alerting.db*` (or `./dev.db*`), restart.  |
| Regenerate the Prisma client after a schema change | `npx prisma generate`                                |
| List stray Nuxt dev processes (Windows)     | `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -like "*nuxi*"` |

## Troubleshooting
| `SMTP_FROM`                 | `From:` header — must be a verified sender.     | `Alerting Bot <alerts@your-domain.tld>`       |

**Postgres warning.** The app checks `DATABASE_URL` at boot and refuses anything that does not start with `file:`. If your shell has `DATABASE_URL` exported to a Postgres URL from an unrelated project, unset it before running the app (`Remove-Item Env:DATABASE_URL` on PowerShell, `unset DATABASE_URL` on bash) so the `.env` value takes effect.

## Where the database lives

### Production / Docker Compose

The SQLite file is at `./data/alerting.db` on the host, bind-mounted to `/data` inside the `nuxt_app` container. The `./data/` folder is git-ignored and is created empty on first boot; Prisma creates the schema the first time the container starts (via `prisma db push` in the Dockerfile's `CMD`).

Because the file lives on the host filesystem, it survives `docker compose down` and `docker compose up` freely. To reset the database, stop the stack and delete `./data/alerting.db*`.

### Local development (`npm run dev`)

The SQLite file lives at the project root: `./dev.db`. During writes, SQLite may create auxiliary files next to it:

```
dev.db
dev.db-journal
dev.db-wal
dev.db-shm
```

All four are in `.gitignore` — never commit any of them. Set `DATABASE_URL=file:./dev.db` in your `.env`.

The path resolution is anchored to the project root (see `server/db/prisma.ts`), so it works whether you run from the project root or from inside `.nuxt/dev/…`.

## Persistence options

Pick one based on whether you want to inspect the DB file directly from the host.

1. **Bind-mount (default).** `./data:/data` in `docker-compose.yaml`. You can inspect the file directly (`sqlite3 ./data/alerting.db`), back it up with `cp`, or reset with `rm`. This is what the shipped compose file uses.
2. **Named Docker volume.** Replace `./data:/data` with `alerting_data:/data` and add:
   ```yaml
   volumes:
     alerting_data:
   ```
   at the top level of the compose file. More portable (no host path leak into the compose file), but inspecting the DB now requires `docker compose exec nuxt_app sh` or `docker cp`.
3. **Local file, no Docker (dev only).** `DATABASE_URL=file:./dev.db`, run `npm run dev` outside of Docker. The daemon still runs in a container.

## Local development without Docker

For iterating on the code with HMR:

```bash
npm install
cp .env.example .env
# in .env, set:
#   DATABASE_URL=file:./dev.db
#   OLVID_DAEMON_URL=http://localhost:50052

# The daemon still needs to be up (in a container is fine).
docker compose up -d daemon

npm run dev
```

Nuxt serves at http://localhost:3000. Server-side changes under `server/` restart Nitro automatically.

## Common operations

| Task                                        | Command                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| Follow app logs                             | `docker compose logs -f nuxt_app`                          |
| Rebuild the image after a dep change        | `docker compose build --no-cache nuxt_app`                 |
| Reset the DB (dev)                          | Stop, `rm ./data/alerting.db*` (or `./dev.db*`), restart.  |
| Regenerate the Prisma client after a schema change | `npx prisma generate`                                |
| List stray Nuxt dev processes (Windows)     | `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -like "*nuxi*"` |

## Troubleshooting

**`npm ci` fails with `EUSAGE — lock file's X does not satisfy Y`** — `package-lock.json` is out of sync with `package.json`. Delete `node_modules/` and `package-lock.json`, then `npm install` to regenerate a coherent lock.

## Repository layout

```
alerting-bot/
├── app/            # Nuxt client (Vue SFCs, composables, utils)
├── server/         # Nitro server (api, services, repositories, tasks)
├── shared/         # Types + logic imported by both client and server
├── prisma/         # schema.prisma (SQLite)
├── i18n/locales/   # en, fr translation files
├── data/           # runtime SQLite + Olvid daemon state (gitignored)
├── Dockerfile
├── docker-compose.yaml
└── .env.example
```

## License

TODO — pick a license before publishing.

Ward- cookies ou header pour valider session
