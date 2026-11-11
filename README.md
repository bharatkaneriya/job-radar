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
| Hosting | Anywhere that runs Node or Docker; Vercel's free tier works | — |

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

### Adding a source

Add an object to `SOURCES` in `lib/server/services/sources/index.js` with `name`, `label`,
`homepage`, `minIntervalHours`, `fetchRaw(cfg)` and `parse(raw, cfg)` returning
`{ sourceId, title, company, url, location, tags, description, postedAt, salary, jobType }`,
add its defaults to `DEFAULT_SOURCES` in `defaults.js` and a fixture in `test/fixtures/`.
