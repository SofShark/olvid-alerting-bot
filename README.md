# Alerting Bot

**Watch things. Get told when they change. On Olvid or by email.**

Alerting Bot is a small self-hosted web app that lets you author alerts against
external data sources and receive the resulting notifications through 
[Olvid](https://olvid.io), by email, or both.

---

## What you can do with it

- **Watch feeds and APIs** — polling any URL that returns JSON, XML, or HTML on
  a cron schedule and firing when a field crosses a threshold, changes, or
  matches a value.
- **Monitor endpoints** — probing a URL periodically and firing on any HTTP
  status class you care about (5xx, non-2xx, specific codes, …).
- **Ingest external events (Webhooks)** — webhook alerts expose an inbound webhook URL
  that third-party systems (GitHub, Grafana, Sentry, custom scripts) can POST
  payloads to.
- **Compose the message** — one alert can produce several *bundles* (one per
  audience/channel), each with its own recipients and its own Handlebars
  template rendered against the incoming payload.
- **Deliver over Olvid or by email** — Olvid recipients get an E2E-encrypted
  DM from the bot; email recipients get a normal SMTP message.
- **Manage users end-to-end** — invite teammates via Olvid, email, or a plain
  shareable link; reset lost passwords over the same channels; admin vs user
  roles; audit each alert's dispatch history from the sidebar.

---

## Setup

You'll do this once, in about ten minutes, before you can create your first alert.

### 1. Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2).
- The **Olvid mobile app** on your phone — the bot needs an Olvid identity to
  send messages, and pairing is done from the phone.
- Optionally, **an SMTP account** if you want the email delivery channel
  (MailPace, Amazon SES, Postfix, whatever). SMTP is not required — the bot
  works with Olvid-only, email-only, or both.

### 2. Copy the environment file

From the project root:

```bash
cp .env.example .env
```

You'll edit `.env` progressively over the next three steps. Every value below
is a line to fill in that file.

### 3. Pair the Olvid daemon

The bot talks to a small **Olvid daemon** container (bundled in this repo's
`docker-compose.yaml`) which holds its Olvid identity and speaks the protocol
for you. Pairing it links a phone-side Olvid profile to the daemon so it can
send DMs on your behalf. Full walkthrough at
<https://doc.bot.olvid.io/en/stable/> — the short version below is enough for
this project.

**a) Start the daemon on its own first.** It needs to be up before the CLI can
talk to it, and before the app can boot:

```bash
docker compose up -d daemon
```

**b) Launch the interactive CLI.** This runs the Olvid Python CLI in a
throwaway container connected to the daemon:

```bash
docker compose run --rm cli
```

**c) Register or link an identity.** The CLI walks you through it — pick
"register a new identity" for a fresh bot, or "invite an existing identity"
to reuse one. Confirm the pairing invitation on your phone's Olvid app.

**d) Copy the client key it prints.** At the end the CLI prints something like
`Client key: 34f52581-…`. Copy it and paste it into `.env`:

```
OLVID_CLIENT_KEY=<client key value provided by the CLI>
```

Leave `OLVID_DAEMON_URL` at its default (`http://daemon:50051`) — that's the
address of the daemon inside the compose network.

The daemon is now yours. It'll show up as a normal Olvid contact on any phone
you paired it with. Any Olvid discussion you start with it (a 1-to-1 chat or
a group where it's a member) becomes a possible delivery target inside the
app's UI.

### 4. Configure email (optional)

Skip this step if you're happy with Olvid-only delivery.

If you do want email, fill the SMTP block in `.env`. Any provider works;
defaults target [MailPace](https://mailpace.com):

```
SMTP_HOST=smtp.mailpace.com
SMTP_PORT=587
SMTP_USER=<your-mailpace-server-token>
SMTP_PASSWORD=<your-mailpace-server-token>
SMTP_FROM=Alerting Bot <alerts@yourdomain.com>
```

`SMTP_FROM` must be a verified sender on your provider or delivery is silently
rejected. When SMTP is off, mail-related options in the UI (invite by mail,
mail bundle output) simply grey out with a tooltip — nothing crashes.

### 5. Generate the auth secrets

Two random strings that only you know about — one signs the login cookie, the
other gates the first-admin setup page.

```bash
# Session cookie secret (must be ≥ 32 chars)
openssl rand -base64 48

# First-admin bootstrap key
openssl rand -base64 32
```

Paste each into the matching line of `.env`:

```
NUXT_SESSION_PASSWORD=…the first one…
ADMIN_KEY=…the second one…
```

Also set the public origin of your deploy — the URL users' browsers actually
open. This becomes the base for outgoing invite / reset links.

```
NUXT_PUBLIC_BASE_URL=http://localhost:3000       # local
# or, once you have a domain:
NUXT_PUBLIC_BASE_URL=https://alerts.example.com
```

### 6. Start the app

```bash
docker compose up -d app
```

That's it — the stack is live at <http://localhost:3000>.

**Making it reachable from other machines.** By default Docker publishes the
port on `0.0.0.0:3000`, so anything on your LAN can already open
`http://<your-machine-lan-ip>:3000`. For a real deployment you'll want a
reverse proxy (Caddy or nginx) sitting in front to add TLS and a proper
hostname. Point it at `localhost:3000` (or the compose service `app:3000`
if the proxy is in the same compose network) and you're done. For a quick
non-Docker dev on your laptop, `npm run dev -- --host` also binds to `0.0.0.0`
so devices on the same wifi can reach the dev server without Docker.

### 7. Create the first admin account

Alerting Bot ships with zero users. On the very first visit, every route
redirects to `/setup`:

1. Open the app — you'll land on `/setup` automatically.
2. Paste the `ADMIN_KEY` value from `.env` into the *Admin key* field. This
   proves you're the operator, not a random visitor who reached the URL first.
3. Enter your login (an email if SMTP is on, otherwise any username), a
   password (min 8 characters), and optionally a display name.
4. Submit.

If SMTP is configured, the app mails you a verification link — click it to
activate the account. If SMTP isn't configured, you're signed in immediately.

From this point on, `/setup` refuses to run again — every subsequent user is
added by an admin from the `/users` page (see [Managing users](#managing-users-and-authentication) below).

---

## Using the app

### First login

Open the app, land on `/login`, enter the credentials you set at `/setup`.
The sidebar populates with your alerts (empty at first) and a **+ New Alert**
button opens the wizard.

Two things worth knowing right away:

- **Everything visible in the app has an inline hint** — hover the small `?`
  icons and the help text in the wizard for context-specific tips. This README
  doesn't repeat every field.
- **The language** switches between English and French from the account
  dropdown (top-right, next to your name). All wizard copy is translated.

### The UI at a glance

Three panes:

- **Left sidebar** — every alert you can see, grouped by status (Active /
  Inactive / Draft). Clicking a row opens it in the main pane.
- **Main pane** — either the *view mode* of a saved alert (its trigger config
  + bundles + dispatch log), or the *wizard* when creating / editing.
- **Top nav** — account menu (name, role, logout, language) and a global
  *Users* link if you're an admin.

### Creating your first alert

Click **+ New Alert** in the sidebar. The wizard walks you through four steps:

1. **General.** Give the alert a title + description. Pick a **Source** — one
   of *Data Polling*, *Monitoring*, or *Webhook*. Each has a short hint about
   what it does; the rest of the wizard tailors itself to the source you picked.

2. **Trigger.** Configure the source:
   - **Polling** → URL to fetch, response format (JSON / XML / HTML), cron
     schedule.
   - **Monitoring** → URL to probe, cron schedule.
   - **Webhook** → nothing to configure; the app generates an inbound URL and
     shows a copy button once the alert is saved.
   The wizard fetches a sample payload live so you can see the shape you'll be
   writing rules against.

3. **Condition.** Describe *when the alert should fire*:
   - Polling & Webhook alerts get a payload tree. Click any value to insert
     its path (`root.data.item.price`) into a rule. Combine multiple rules
     with AND/OR. Pick a comparison operator (`>`, `<`, `==`, `contains`,
     `changed`, …). Aggregation operators (`sum`, `average`, `min`, `max`)
     support wildcard paths.
   - Monitoring alerts get a status-match rule: specific codes, a range
     (2xx / 3xx / 4xx / 5xx), or the shortcut "any non-2xx".
   - **Trigger mode** decides when the alert re-fires when the condition
     stays true: every time / once (edge-detected) / on recovery (fires once
     when true, again when it goes back to false).

4. **Bundles.** *A bundle is one message, sent to one set of recipients, in
   one format.* An alert can carry many bundles — useful when different
   teams want the same alert phrased differently. For each bundle:
   - Pick a **channel** — Olvid or email — and add recipients.
     - Olvid → contacts + groups from the daemon's discussion list.
     - Email → any address you type.
   - Pick a **format** — a plain summary, the raw payload, or a Handlebars
     template. Custom formats open a **full-screen editor** with three panes:
     script (left), payload tree (middle, click to insert paths), and a live
     preview (right, in an Olvid chat bubble or a mail card). The *Load
     Template* dropdown offers pre-built recipes for GitHub, Grafana, Sentry,
     and more.

Save the alert. It lands in *Draft* status. Once the wizard is confident it's
complete (has at least one bundle with recipients, a valid condition, a
schedule where relevant), the sidebar's status toggle activates it — and the
next scheduled run will pick it up.

### Testing an alert before going live

Every saved alert has a **Run test** button in the view pane. It runs the full
pipeline (fetch → parse → evaluate → render bundles) *without dispatching*, and
opens a result modal showing what fired, why, and what each bundle would have
looked like. Ideal for tuning your condition or your Handlebars template
without spamming your Olvid contacts.

### Reading the dispatch log

Once the alert is active, every scheduled run — success or failure — writes
one row to the log panel underneath the view. Labels are colour-coded:

| Label       | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| **Sent**    | Every channel of every bundle delivered.                                     |
| **Partial** | Some channels delivered, some failed. Expand for the per-channel breakdown.  |
| **Failed**  | Everything failed, or the run bailed before dispatch (fetch/parse error).    |

Click the chevron on any row to see the details: pipeline stage that ran, the
top-level error if any, and per-channel outcomes (recipient count, error
line).

---

## Managing users and authentication

### Roles

- **User** — signs in, sees alerts, can subscribe themselves to error
  notifications on any alert.
- **Admin** — everything a user does, plus: create / delete users, invite
  through any channel, delete alerts, edit bundles.

Admins can neither delete themselves nor delete the last remaining admin —
those buttons refuse with a tooltip.

### Inviting users

From `/users`, click **Invite user**. Pick a delivery channel:

- **Email** — sends an invitation email with a one-click link.
  Requires SMTP configured and an email address for the invitee.
- **Olvid** — DMs the same link over Olvid. Requires the bot to already have
  a contact discussion with the invitee (they've added the bot on their
  phone). Group discussions are filtered out — invites go to **contacts only**.
- **Shareable link** — no delivery. The modal reveals the URL for you to hand
  over out-of-band (Signal, in person, whatever).

The invitee opens the link, picks a password (min 8 chars), and lands signed
in. If invite delivery fails for mail/Olvid, the modal falls back to the
shareable-link view so you can still hand the URL over.

You can invite either a *user* or an *admin* by toggling the role pill in the
invite modal. Role is set at invite time — to change it later, delete +
reinvite.

### Forgot my password

The `/login` page has a **Forgot my password?** link. Enter your login, and
the server picks a delivery channel from your account:

1. Olvid, if the account has a linked Olvid discussion.
2. Email, if the account has an email and SMTP is on.
3. Neither — the UI tells you to contact your admin, who can reissue a fresh
   invitation from `/users`.

The link takes you to `/reset-password?token=…`, you set a new password, and
you're signed back in. Rate-limited to one request per user per 60 seconds.

### Deleting a user

From the user row, click **Delete** and confirm. If the user was still
*pending* (never accepted their invite) and the invite went out over Olvid,
the bot revokes the invite DM from the invitee's chat before removing the
row — no dangling links.

### Why prefer Olvid over email?

Both work; Olvid gives you three concrete wins for auth traffic:

- **E2E-encrypted delivery.** Invitation and password-reset links travel
  inside Olvid's encrypted channel — they never touch an SMTP relay, never
  land in a webmail archive.
- **Phishing resistance.** No mail sender to spoof; the invite arrives from
  the bot's Olvid identity, verifiable by whoever added the contact on their
  phone.
- **Fewer moving parts.** No SMTP provider, no verified-sender dance, no
  spam-folder debugging.

The mail channel remains as a fallback for people who aren't on Olvid; a
deployment that wants the tightest posture can invite every admin over Olvid
and leave SMTP configured only for outbound bundle-output emails.

---

## Technical reference

The high-level story above is enough to run the app. This section is for
operators, contributors, and future-me.

### Stack

- **[Nuxt 4](https://nuxt.com)** — Vue 3 SFCs, Nitro server, Vite bundler.
- **[Prisma 7](https://www.prisma.io/) + SQLite** — data layer, migrations
  under `prisma/`.
- **[nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils)** — signed
  session cookies.
- **[Olvid Bot Node SDK](https://doc.bot.olvid.io/)** — gRPC client that
  talks to the daemon container.
- **[Handlebars](https://handlebarsjs.com/)** — bundle message templating.
- **@nuxtjs/i18n** — en / fr locales.

### Compose services

| Service  | Image / build                     | Role                                                                 |
| -------- | --------------------------------- | -------------------------------------------------------------------- |
| `app`    | built from `Dockerfile`           | Nuxt app — UI, HTTP API, and the `polling:heartbeat` scheduled task. |
| `daemon` | `olvid/bot-daemon:2.0.1`          | Olvid bot daemon. gRPC on `:50051`.                                  |
| `cli`    | `olvid/bot-python-runner:2.0.1`   | Interactive Olvid CLI. Only used at pairing time.                    |

### Environment variables

| Variable                | Required                | Purpose                                                                                            |
| ----------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes                     | SQLite path. Must start with `file:`. Compose default: `file:/data/alerting.db`.                   |
| `OLVID_DAEMON_URL`      | yes                     | gRPC endpoint of the daemon.                                                                       |
| `OLVID_CLIENT_KEY`      | yes                     | Client key printed by the CLI at pairing.                                                          |
| `NUXT_SESSION_PASSWORD` | yes                     | Signs the session cookie. ≥ 32 chars.                                                              |
| `ADMIN_KEY`             | yes                     | First-run bootstrap secret for `/setup`.                                                           |
| `NUXT_PUBLIC_BASE_URL`  | yes for prod            | Origin used in outgoing invite / verification / reset URLs.                                        |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | conditional | Optional — enables the email delivery + email-invite + email-reset paths.                          |

### Repository layout

```
alerting-bot/
├── app/            # Nuxt client — Vue SFCs, composables, utils, i18n bundles
├── server/         # Nitro server — api, services, repositories, tasks, clients
├── shared/         # Types + pure logic imported by both client and server
├── prisma/         # schema.prisma (SQLite)
├── i18n/locales/   # en, fr translation files
├── data/           # runtime SQLite + Olvid daemon state (gitignored)
├── Dockerfile
├── docker-compose.yaml
└── .env.example
```

### Local dev without Docker

```bash
# Daemon still runs in Docker — the app is what you hot-reload.
docker compose up -d daemon

# Point the local dev server at the host-exposed daemon port.
# .env → OLVID_DAEMON_URL=http://localhost:50051  (only for local dev)
# .env → DATABASE_URL=file:./dev.db               (separate from the compose DB)

npm install
npx prisma generate
npm run dev            # http://localhost:3000
npm run dev -- --host  # http://0.0.0.0:3000 (reachable from LAN)
```

### Common ops

| Task                                    | Command                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| Follow app logs                         | `docker compose logs -f app`                              |
| Follow daemon logs                      | `docker compose logs -f daemon`                           |
| Rebuild after a dep change              | `docker compose build --no-cache app`                     |
| Regenerate the Prisma client            | `npx prisma generate`                                     |
| Reset the DB (compose)                  | `docker compose down -v`  ⚠ also drops the daemon volume  |
| Reset the DB (local dev)                | `rm ./dev.db*` and restart `npm run dev`                  |

---

## License

TODO — pick a license before publishing.
