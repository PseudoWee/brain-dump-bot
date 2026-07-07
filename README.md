# Brain Dump Bot

A Telegram bot for quick-capture notes, reminders, and export. Node.js/TypeScript, using
[grammY](https://grammy.dev), [Drizzle ORM](https://orm.drizzle.team), and Postgres (Supabase).

## Features

- Send any text message and it's saved as a timestamped note.
- Reply to a "Saved as note #N" confirmation with `/remind <when>` (e.g. "tomorrow 9am",
  "in 2 hours") to get nudged later. Or use `/remind <note_id> <when>` directly.
- `/notes [n]` - view your recent notes.
- `/reminders` / `/cancel <id>` - manage upcoming reminders.
- `/delete <note_id>` - delete a note.
- `/export [days]` - export your notes as a Markdown file (omit `days` for everything).
- `/summary [days]` - get an AI-written summary of your notes via an open-weight LLM
  (omit `days` for everything).
- **Natural language**: you don't have to remember slash syntax. Chatting normally — "remind me
  about note 3 tomorrow at 9am", "delete note 1", "show my reminders", "summarize the last 7 days" -
  gets routed to the same commands above. A message only pays for an LLM classification call if it
  contains a command-like keyword (remind/delete/cancel/summar/export/list/show); anything else is
  saved as a plain note instantly, same as before. Since this relies on the same LLM as `/summary`,
  it can occasionally misfire on ambiguous phrasing — if it does, just use the slash command
  directly for precision.

## 1. Create the Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram, run `/newbot`, and follow the prompts.
2. Copy the bot token it gives you.

## 2. Create the database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. On the project dashboard, click the **Connect** button (top toolbar) and open the
   **Connection String** tab. Use the pooled connection (**Transaction pooler**, or **Session
   pooler** if that's what your dashboard shows) — not "Direct connection".
   - The direct `db.<ref>.supabase.co` hostname is IPv6-only on most Supabase projects now, and
     will fail with `ENOTFOUND` on networks without outbound IPv6 (most home/office networks).
     The pooler hostname (`aws-0-<region>.pooler.supabase.com`) is IPv4-compatible.
   - This bot already sets `prepare: false` in [src/db/client.ts](src/db/client.ts), which is
     required for Transaction pooler mode (and harmless for Session mode too), so either works.
3. Copy the connection string — note the username is `postgres.<project-ref>`, not just
   `postgres`, when using a pooler. This is your `DATABASE_URL`.

## 3. Get an OpenRouter API key (for /summary)

1. Create a free account at [openrouter.ai](https://openrouter.ai) and generate a key at
   [openrouter.ai/keys](https://openrouter.ai/keys). This is your `OPENROUTER_API_KEY`.
2. The default (`openrouter/free`) is OpenRouter's free-model router — it costs nothing and
   automatically picks from whichever free models are currently live, so it keeps working even as
   individual free model slugs get added/retired. Its one downside: it can occasionally pick a
   non-open-weight model from the free pool (e.g. a free Gemini variant) instead of an open-weight
   one like Llama/Qwen.
3. If you'd rather pin a specific open-weight model, browse
   [openrouter.ai/models](https://openrouter.ai/models), filter by "Free", and set
   `OPENROUTER_MODEL` to its id (e.g. `meta-llama/llama-3.3-70b-instruct:free`) — but note specific
   free slugs get retired over time, which will make `/summary` fail with a 404 until you update
   it. For a paid model instead, drop the `:free` suffix and add credits to your account at
   [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits) — paid models return a
   402 error without credits.

## 4. Configure locally

```bash
cd brain-dump-bot
npm install
cp .env.example .env
```

Fill in `.env`:

- `BOT_TOKEN` — from BotFather.
- `DATABASE_URL` — from Supabase.
- `TZ` — IANA timezone for interpreting reminder times, e.g. `Asia/Singapore` (defaults to UTC).
- `ALLOWED_USER_IDS` — optional, comma-separated Telegram user IDs to restrict the bot to just you
  (get your ID from [@userinfobot](https://t.me/userinfobot)).
- `OPENROUTER_API_KEY` — from step 3 above. Required — the bot won't start without it.
- `OPENROUTER_MODEL` — optional, defaults to `meta-llama/llama-3.3-70b-instruct`.

Push the schema to your database:

```bash
npm run db:push
```

Run locally:

```bash
npm run dev
```

Message your bot on Telegram to try it out.

## 5. Deploy to Railway

1. Create a project at [railway.app](https://railway.app) and connect this repo (or `railway init`
   + `railway up` from the CLI).
2. In the Railway project's **Variables** tab, set `BOT_TOKEN`, `DATABASE_URL`, `TZ`,
   `ALLOWED_USER_IDS`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL` to the same values as your
   `.env`. All except `TZ`/`ALLOWED_USER_IDS`/`OPENROUTER_MODEL` are required — the bot crashes on
   startup if any required variable is missing.
3. Railway will build using the included `Dockerfile` and start the bot with `node dist/bot.js`.
   It runs as a long-lived process using Telegram long polling, so no public URL/webhook is needed.
4. Check the deploy logs for `Brain Dump bot is running.`

## Notes

- Reminders are checked every 30 seconds by a polling loop in the bot process
  ([src/scheduler/reminders.ts](src/scheduler/reminders.ts)) — no separate cron job needed.
- To change the schema, edit [src/db/schema.ts](src/db/schema.ts) then run `npm run db:push`
  (or `npm run db:generate` if you want versioned migration files in `drizzle/`).
- `npm run db:studio` opens Drizzle Studio, a web UI to browse your Supabase data.
