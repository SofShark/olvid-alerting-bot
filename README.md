<h1>
  <img src="app/assets/olvid_name_logo.png" alt="Alerting Bot logo" width="200" align="bottom" />
  Alerting Bot
</h1>

Self-hosted alerting platform
powered by Nuxt 4 and Olvid.
- Webhooks
- HTTP monitoring
- Data polling
- Olvid + Email delivery
- Multi-user
- Template editor
- Docker ready

## 📒 Index

- [About](#about)
  - [Overview on Olvid's Alerting Bot](#overview-on-olvid's-alerting-bot)
  - [Composing the message](#composing-the-message)
  - [Multi-user out of the box](#multi-user-out-of-the-box)
  - [Why Olvid as a channel?](#why-olvid-as-a-channel)
- [Usage](#usage)
  - [Installation](#installation)
    - [Pre-Requisites](#pre-requisites)
    - [Get the code](#get-the-code)
  - [Configuration](#configuration)
    - [Prepare the environment file](#prepare-the-environment-file)
    - [Pair the Olvid daemon](#pair-the-olvid-daemon)
    - [Configure email (optional)](#configure-email-optional)
    - [Generate the auth secrets](#generate-the-auth-secrets)
  - [Build & deployment](#build--deployment)
    - [Start the app](#start-the-app)
    - [Expose the app publicly](#expose-the-app-publicly)
    - [Create the first admin account](#create-the-first-admin-account)
- [Guideline](#guideline)
  - [First login](#first-login)
  - [The UI at a glance](#the-ui-at-a-glance)
  - [Creating your first alert](#creating-your-first-alert)
  - [Testing an alert before going live](#testing-an-alert-before-going-live)
  - [Reading the dispatch log](#reading-the-dispatch-log)
  - [Managing users and authentication](#managing-users-and-authentication)
    - [Roles](#roles)
    - [Inviting users](#inviting-users)
    - [Forgot my password](#forgot-my-password)
    - [Deleting a user](#deleting-a-user)
- [FAQ](#faq)
- [Resources](#resources)
- [Gallery](#gallery)
- [Development](#development)
  - [Build](#build)
  - [Deployment](#deployment)
  - [Development (hot-reload)](#development-hot-reload)
  - [File Structure](#file-structure)
- [Credit / Acknowledgment](#credit--acknowledgment)
- [License](#license)

---

# About
## Overview on Olvid's Alerting Bot
**Alerting Bot** is a self-hosted web app that watches external data sources
and routes the resulting notifications to a channel of your choice. You author
each alert in an intuitive interface, and the app takes care of scheduling,
evaluating, formatting, and dispatching the messages — you never write a line
of code to receive a notification.

Under the hood, three kinds of alert cover the vast majority of what a small
team needs to keep an eye on:

- **Webhook alerts** — the app exposes an inbound URL and reacts to whatever
  a third-party (GitHub, Grafana, Sentry, your own scripts, …) POSTs to it.
- **Data Polling alerts** — periodically fetch a URL, parse the JSON / XML /
  HTML response, evaluated the selected watched field(s) and fire when they sattisfy the
  specificated trigger condition (crosses a threshold,
  change from previous value, matches a value).   
- **Monitoring alerts** — periodically probe an HTTP endpoint and fire on the
  HTTP status classes you care about (5xx, non-2xx, specific codes, …). 

For more information on how to configure alerts see [Creating your first alert](#creating-your-first-alert).
### Composing the message

A **format editor** lets you point-and-click at fields from a live sample
payload to build the outgoing message. The same editor lets you write full templates
against the parsed tree, with an inline Olvid-chat / email-card preview so
you always see what your recipients will see. You'll be able to style the message
using Olvid's native markdown format, or standard html tags for emails. 

The email channel is still there as a fallback (for recipients who aren't on
Olvid), but Olvid is the recommended default: fewer moving parts, better
security posture, and richer routing (groups).

---

# Usage
## 🚀 Quick Start

The first installation takes around **10 minutes**.
At a high level, you'll:

1. Clone the repository.
2. Copy `.env.example` to `.env`.
3. Pair the bundled Olvid daemon.
4. Fill the required `.env` variables.
5. Start the application.
6. Create the first administrator account.

Each step is explained in detail below.

## Installation

### Requirements

Before starting, make sure you have:

- **Docker Desktop**, or Docker Engine + Compose v2.
- **[Olvid](<https://olvid.io/>)** app installed (on phone or desktop) required to pair the bot (optional)
- SMTP server credentials if you want email delivery. (optional)

### Get the code

Clone the repository:

```bash
git clone https://github.com/<your-org>/alerting-bot.git
cd alerting-bot
```

## ⚙️ Configuration

### Prepare the environment file

From the project root, copy the template:

```bash
cp .env.example .env
```

You'll fill `.env` progressively over the next four steps. Every code block
below points at one or more variables to set in that file.

### 🤖 Pair the Olvid daemon
The daemon is the bridge between Alerting Bot and the Olvid network.
Once paired, the daemon becomes the identity used to send all Olvid notifications.

**a) Start the daemon** in background with the following command:

```bash
docker compose up -d daemon
```

To confirm it started cleanly, follow its logs for a moment:

```bash
docker compose logs -f daemon
```

Once the log lines stop scrolling, press **Ctrl + C** to detach — the daemon keeps running in the background.

**b) Launch the interactive CLI.** 

```bash
docker compose run --rm cli
```

**c) Follow the CLI through pairing.** The CLI walks you through the whole
flow. Annotated transcript below — the strings after `>` are what you type:

```text
# Create a new identity. Replace FirstName, LastName, ... with your bot's
# persona. LastName, Position and Company are optional and editable later.
0 > identity new FirstName LastName

# A client key to connect to daemon is automatically created.
# Save it — you'll paste it into .env in the next step.
identity creation > Here is your client key to connect to daemon with this identity:
AAAAAAAA-BBBB-AAAA-AAAA-AAAAAAAAAAAA

# Enter "yes" so the bot appears in your personal Olvid contacts —
# required to start a 1-to-1 discussion with it later.
identity creation > Do you want to add this identity to your contacts ? (y/N)
> yes

# The CLI prints an Olvid invitation link. Open it in your web browser to
# show a QR you can scan with the Olvid mobile app, OR paste it into your
# Olvid desktop client.
identity creation > Send an invitation to this invitation link: https://invitation.olvid.io/#........

# The CLI now waits for the invitation to arrive from your phone.
# Once you accept on the phone, the two devices exchange short SAS codes.
identity creation > Please enter sas code displayed on the other device

# Type the 4-digit SAS code shown on your Olvid mobile app:
> 0000

# The CLI shows a 4-digit code — enter THIS code on your phone:
identity creation > Please enter this sas code on the other device: 1111

# Pairing is now complete.
Now using identity: 1
You can now send messages to <YOUR NAME> in discussion 1

# Quick sanity check — DM yourself:
1 > message send 1 Hello World !

# Exit the CLI when you're done (or press Ctrl + D).
1 > exit
```

**d) Copy the client key into `.env`.** Paste the value the CLI printed
(right after `Here is your client key…`) here:

```
OLVID_CLIENT_KEY=<the client key value the CLI printed>
```

In case you cleared the terminal or lost the key, you can retrieve it by running:
```bash
docker compose run --rm cli
0 > key get
```

The daemon is now paired with your Olvid identity, and the alerting bot is connected to the daemon on its turn.

### 🔐 Generate the auth secrets

Two random strings that only you know about — one signs the login cookie, the
other gates the first-admin setup page:

```bash
# Session cookie secret (must be ≥ 32 chars)
openssl rand -base64 32

# First-admin bootstrap key.
openssl rand -base64 32
```

Paste each into the matching line of `.env`:

```
NUXT_SESSION_PASSWORD=…first key…
ADMIN_KEY=…second key…
```

### ✉️ Configure email (optional)

Skip this step if you're happy with Olvid-only delivery. Set it up if you
want any of: email as a bundle output, invite-by-email, or password-reset by
email.


```
SMTP_HOST=smtp.mailpace.com
SMTP_PORT=587
SMTP_USER=<your-mailpace-server-token>
SMTP_PASSWORD=<your-mailpace-server-token>
SMTP_FROM=Alerting Bot <alerts@yourdomain.com>
```

`SMTP_FROM` must be a verified sender on your provider or delivery is
silently rejected.

## 🔨 Build & deployment

```bash
docker compose up -d app
```

Once logs hace stopped scrolling it means your docker container has been successfully built. 
You can now run the alerting-bot app.

```bash
docker compose up -d app
```

That's it — the stack is live at <http://localhost:3000>.

### 📢 Expose the app publicly

By default, Docker publishes port 3000 on `0.0.0.0`, so anything on your LAN
can already open `http://<your-machine-lan-ip>:3000`.

For a real public deployment you can use a reverse proxy like Caddy or nginx.
Point the proxy at `localhost:3000` (or the compose service `app:3000` if the 
proxy runs in the same compose network).

### 👤Create the first admin account

Alerting Bot ships with zero users. 

1. Open the app — you'll land on `/setup` automatically.
2. Paste the `ADMIN_KEY` value from `.env` into the *Admin key* field. This
   proves you're the operator, not a random visitor who reached the URL
   first.
3. Enter your login (an email address if SMTP is on, otherwise any plain
   username), a password (min 8 characters), and optionally a display name.
4. Submit.

You can additionally choose to verify your account sending a verification link to 
your Olvid discussion (that you linked to the daemon previously) or an email (in case
SMTP is available). This will allow you to recover your password in future logins.


From this point on every subsequent user is added by an admin from the `/users` page (see
[Managing users and authentication](#managing-users-and-authentication)).

---

# 📋Guideline

## Creating your first alert

Click **+ New Alert** in the sidebar. The wizard walks you through four
steps:

1. **General.** Give the alert a title + description. Pick a **Source** —
   *Data Polling*, *Monitoring*, or *Webhook*. Each has a hint under the
   picker explaining what it does; the rest of the wizard tailors itself to
   the source you picked.

2. **Trigger.** Configure the source:
   - **Polling** → URL to fetch, response format (JSON / XML / HTML), cron
     schedule.
   - **Monitoring** → URL to probe, cron schedule.
   - **Webhook** → nothing to configure; the app generates an inbound URL
     and shows a copy button once the alert is saved.

   The wizard fetches a sample payload live so you can see the shape you'll
   be writing rules against.

3. **Condition.** Describe *when the alert should fire*. Webhook alerts
   skip this step — every incoming POST is treated as the fire event, so
   there is no condition to author.

   - **Polling alerts** — click any value in the payload tree to insert
     its path (e.g. `root.data.item.price`) into a rule. A rule is one
     path + one comparison operator (`>`, `<`, `==`, `contains`,
     `changed`, …). You can add several rules and combine them:
     - **All of** (AND) — every rule must fire.
     - **Any of** (OR) — a single firing rule is enough.
     - **Sum / Average / Min / Max** — aggregate the numeric values
       across all matched paths into a single number, then compare it
       to the threshold (fires when e.g. *sum* > 100).

     **Wildcards.** Paths that contain a **double dot (`..`)** match
     zero or more segments, so one rule can cover a whole shape:
     - `root.items..price` — every `price` anywhere under `items`, no
       matter the depth or index.
     - `..error` — every `error` field wherever it appears in the
       response.
     - `sensors..[0].value` — the first `value` inside every sensor.

     A wildcard rule expands to one verdict per concrete match at eval
     time.

   - **Monitoring alerts** — status-match rule: specific codes
     (`404, 500`), a range (`2xx` / `3xx` / `4xx` / `5xx`), or the
     shortcut *any non-2xx*.

   - **Trigger mode** decides how the alert re-fires when the condition
     stays true:
     - **Every time** — fire on every poll while the condition is met.
     - **Once** — fire only when the condition transitions false → true.
     - **On recovery** — fire once when true, and again when it goes
       back to false (recovery message is prefixed `✓ RECOVERED:`).

4. **Bundles.** A **bundle** represents a group of discussions and the formatn
template that will be applied to the alert's message. An alert can carry many bundles — useful when different
   teams want the same alert phrased differently. For each bundle:
   - Pick a **channel** — Olvid or email — and add recipients.
     - Olvid → contacts *and groups* from the daemon's discussion list.
       Discussions the daemon already knows about show up in the selector
       automatically; adding a new one is one click.
     - Email → any address you type.
   - Pick a **format** — a plain summary, the raw payload, or a custom script
     template. Custom formats open a **full-screen editor** with a script (upper-left), 
     payload tree (lower-left, click to insert paths), and a
     live preview (right). 

## Testing an alert before going live

Monitoring and Polling alerts, once saved, have a **Run test** button in the view pane. It runs the
full pipeline (fetch → parse → evaluate → render bundles) *without
dispatching*, and opens a result modal showing what fired, why, and what
each bundle would have looked like. Ideal for tuning your condition or your
Handlebars template without spamming your Olvid contacts.

## Reading the dispatch log

Once the alert is active, a log panel will update on every scheduled run or inbound trigger.
Rows are colour-coded:

| Label       | Meaning                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| **Sent**    | Every channel of every bundle delivered.                                    |
| **Partial** | Some channels delivered, some failed. Expand for the per-channel breakdown. |
| **Failed**  | Everything failed, or the run bailed before dispatch (fetch/parse error).   |

## 👥 Managing users and authentication

### Roles

Everyone with an account can do the day-to-day work — read, create, edit,
test, and delete alerts and their bundles. The role only gates the
**user-management** surface:

- **User** — full access to alerts: browse the list, create new ones, edit
  triggers / conditions / bundles, run tests, view dispatch logs, and delete
  alerts they no longer need. Cannot access `/users`.
- **Admin** — everything a user does, plus the `/users` page: invite new
  people through any channel, list existing users, and delete accounts.

Admins can neither delete themselves nor delete the last remaining admin —
those buttons refuse with a tooltip.

### Inviting users

From `/users`, click **Invite user**. Pick a delivery channel:

- **Email** — sends an invitation email with a one-click link. Requires
  SMTP configured and an email address for the invitee.
- **Olvid** — DMs the same link over Olvid. Requires the bot to already
  have a contact discussion with the invitee (the invitee has added the
  bot on their phone). Group discussions are filtered out here — user
  invitations always go to **contacts only** (bundle deliveries have no
  such restriction).
- **Shareable link** — no delivery. The modal reveals the URL for you to
  hand over out-of-band.

You can invite either a *user* or an *admin* by toggling the
role pill in the invite modal.


### Deleting a user

From the user row, click **Delete** and confirm. If the user was still
*pending* (never accepted their invite) and the invite went out over Olvid,
the bot revokes the invite DM from the invitee's chat before removing the
row — no dangling links or invitations sent by mistake.

---

# 🧐 FAQ

**Do I need both Olvid and SMTP?**
No. Olvid alone works. SMTP alone works. Both together works. Configure
whichever channels you want to use.

**Can one alert deliver to Olvid AND email?**
Yes — one *bundle* is one channel, but an alert can carry many bundles.
Add one Olvid bundle for the on-call group and one email bundle for the
mailing list, both fed by the same trigger.

**What happens if the daemon is down when an alert fires?**
The dispatch is marked `Failed` in the log with the daemon error surfaced
per channel. The alert itself keeps its schedule; the next tick tries
again.

**Where is my data stored?**
SQLite, in the `alerting_db` Docker volume (`docker compose down -v` wipes
it). Olvid daemon state is in the bind-mounted `./data` folder next to the
repo.

**How do I reset everything?**
`docker compose down -v` (drops the DB volume and the running parts) + `rm -rf ./data/*` (drops
the daemon state). Restart, redo the setup. 


---

# Resources

- **Olvid** — <https://olvid.io/>
- **Olvid bot daemon docs** — <https://doc.bot.olvid.io/en/stable/>
- **Nuxt 4** — <https://nuxt.com/>
- **Prisma** — <https://www.prisma.io/>
- **Handlebars** — <https://handlebarsjs.com/>
- **MailPace (SMTP)** — <https://mailpace.com/>
- **nuxt-auth-utils** — <https://github.com/atinux/nuxt-auth-utils>

---


# Development

For local Vue / server-side work outside Docker:

```bash
# Keep the daemon running in Docker; only the app is hot-reloaded.
docker compose up -d daemon

# In .env, point the local dev server at the host-exposed daemon port
# and use a separate SQLite file from the compose one:
#   OLVID_DAEMON_URL=http://localhost:50051
#   DATABASE_URL=file:./dev.db

npm install
npx prisma generate
npm run dev             # http://localhost:3000
```

## File Structure

```
alerting-bot/
├── app/            # Nuxt client — Vue SFCs, composables, utils, i18n bundles
├── server/         # Nitro server — api, services, repositories, tasks, clients
├── shared/         # Types + pure logic imported by both client and server
├── prisma/         # schema.prisma (SQLite)
├── i18n/locales/   # en, fr translation files
├── data/           # runtime SQLite + Olvid daemon state
├── Dockerfile
├── docker-compose.yaml
└── .env.example
```

---

# Credit / Acknowledgment

**Alerting Bot v1.0** designed and developed by **Sofia Maeso Shakh**  
Special thanks to **Matthieu Finiasz** for his guidance and mentorship throughout the project.

Built on top of the [Olvid Bot Daemon](https://doc.bot.olvid.io/)
Stack: [Nuxt 4](https://nuxt.com/), [Vue 3](https://vuejs.org/),
[Nitro](https://nitro.build/), [Prisma](https://www.prisma.io/),
[SQLite](https://www.sqlite.org/), [Handlebars](https://handlebarsjs.com/),
[nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils),
[@nuxtjs/i18n](https://i18n.nuxtjs.org/), [Lucide icons](https://lucide.dev/).
