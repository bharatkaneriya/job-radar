# Job Radar

A web app that pulls remote developer jobs from public job boards, scores each post
against each user's skills and preferences, and lets them track applications.

- **Visitors** see the home page and can sign up (email/password or Google).
- **Users** set up a profile (weighted skills, keywords, locations, job types, minimum score),
  then work through their scored job list: filter, search, set status
  (new / saved / applied / interview / offer / rejected / skipped) and keep notes.
  The list is read from MongoDB; **Live search** checks the boards again for new posts.
- **Admins** use the same app with extra menu items: manage users (role, enable/disable,
  delete) and job sources (enable/disable, fetch now).

Nothing is ever applied for or sent on the user's behalf.

## Stack

One Next.js app, frontend and API together:

| Part | Tech | Folder |
|---|---|---|
| Web | Next.js 16 (App Router), Tailwind 4, SWR | `app/`, `components/` |
| API | Next.js route handlers, Mongoose, JWT in an httpOnly cookie | `app/api/`, `lib/server/` |
| DB | MongoDB Atlas (free M0 works) | — |
| Hosting | Vercel free tier, one project | — |

## How jobs flow

1. **Fetch** (`lib/server/services/fetchJobs.js`): every enabled source is fetched into one
   shared `jobs` collection. Each source has a minimum interval (Remotive asks for ≤ 4 calls a
   day), tracked in `sourcefetches`, so many users never hammer the boards.
2. **Match** (`lib/server/services/matchUser.js`): the pool is scored against a user's profile
   (`score.js` → `buildScoreConfig`) and the results go into `userjobs`. Status and notes are
   never overwritten by a re-score.
3. Fetch + match run on: **Live search** (per user, at most every 5 min), profile save
   (match only), admin **Fetch now**, and a **daily Vercel cron** (`/api/cron/daily`).

Score guide: **30+** strong fit, **20–29** worth a look, **15–19** borderline.
Skills count their weight (×2 in the title); "US only"-style posts outside your locations,
non-dev roles, other main stacks and your "avoid" keywords push posts down.

## Run locally

Requires Node 20+.

```powershell
npm install
npm run dev:memory        # in-memory MongoDB + sample job data, nothing to set up
#   or: copy .env.example .env, fill MONGODB_URI + JWT_SECRET, then: npm run dev
# http://localhost:3000
```

With `dev:memory` and no `.env`, signing up as `admin@example.com` gives you an admin account
(data is lost when it stops). Set `SOURCES_DEMO=0` to hit the real job boards.

Tests (unit + full API flow on an in-memory MongoDB):

```powershell
npm test
```

## Deploy to Vercel (free)

1. **MongoDB Atlas**: create a free M0 cluster, a database user, and under *Network Access*
   allow `0.0.0.0/0` (Vercel has no fixed IPs). Copy the connection string.
2. Push this repo to GitHub.
3. **Vercel**: *Add New Project* → this repo, default *Root Directory*. Environment variables:
   | Name | Value |
   |---|---|
   | `MONGODB_URI` | Atlas connection string (include a db name, e.g. `/job-radar`) |
   | `JWT_SECRET` | long random string |
   | `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | same Google client ID (optional) |
   | `ADMIN_EMAILS` | your email, so your sign-up becomes admin |
   | `CRON_SECRET` | random string (Vercel Cron sends it automatically) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | mail server for password reset codes |
4. **Google sign-in** (optional): Google Cloud Console → *APIs & Services → Credentials →
   Create OAuth client ID → Web application*. Add *Authorized JavaScript origins*:
   `http://localhost:3000` and your site URL. No redirect URI is needed.
5. Promote an existing account to admin any time:
   `npm run seed:admin -- you@example.com` (with `.env` pointing at Atlas).

Free-tier limits to know: Vercel Hobby runs the cron **once a day** and functions are capped
at 60 s here (sources are fetched in parallel to fit). Live search fills the gap between crons.

## Forgot password

*Forgot password?* on the login page emails a 6-digit code over SMTP (`SMTP_*` in `.env`).
With Gmail, use `smtp.gmail.com`, port `587` and an
[App Password](https://myaccount.google.com/apppasswords), not your normal password.
Without `SMTP_HOST`, local dev prints the code in the server log and production turns
reset requests away.

Three steps: email, code, new password. A code lasts 10 minutes, works once and dies after
5 wrong guesses. A correct code is swapped for a one-time token (also 10 minutes) that sets the
password. Each account can get one code a minute and 5 an hour. A successful reset logs out all
of the account's existing sessions. The rules are in `lib/server/services/passwordReset.js`.

## Project layout

```
app/page.js                 public home page
app/(auth)/                 login, signup
app/(app)/                  logged-in area: dashboard, jobs, profile, admin/*
app/api/                    route handlers: auth, profile, jobs, admin, cron, health
components/AppShell.js      shared layout; menu depends on role
proxy.js                    redirects logged-out visitors to /login
lib/api.js                  browser fetch wrapper
lib/server/http.js          route() wrapper: auth, body parsing, rate limit, errors
lib/server/models/          User, Profile, Job, UserJob, SourceFetch, Setting
lib/server/services/sources/  one fetch + parse pair per job board
lib/server/services/score.js  scoring + per-profile config
lib/server/services/defaults.js  shared rules, default sources, suggested skills
scripts/                    dev-memory, seed-admin
test/                       node:test suites + fixtures
```

Route handlers import server code as `#server/...` (`imports` in `package.json`), which
resolves the same under Next and `node --test`.

### Adding a source

Add an object to `SOURCES` in `lib/server/services/sources/index.js` with `name`, `label`,
`homepage`, `minIntervalHours`, `fetchRaw(cfg)` and `parse(raw, cfg)` returning
`{ sourceId, title, company, url, location, tags, description, postedAt, salary, jobType }`,
add its defaults to `DEFAULT_SOURCES` in `defaults.js` and a fixture in `test/fixtures/`.

**Not included on purpose:** Upwork and LinkedIn prohibit scraping. Listings link back to the
original post (Remotive requires attribution); don't republish them elsewhere.
