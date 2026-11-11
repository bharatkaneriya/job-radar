---
name: project-review
description: Review pending Job Radar changes (working tree, a branch, a commit range or given paths) against this project's own rules — route() conventions, auth and per-user data scoping, #server imports, force-dynamic GETs, Mongoose model guards, matchUser invariants, password-reset secrecy, logging redaction, SWR form patterns and test coverage. Use when asked to review, check or sanity-check changes in this repo before committing or opening a PR.
argument-hint: "[target: nothing = uncommitted changes | <branch> | <commit>..<commit> | <paths>]"
---

# Job Radar code review

Review the changes for bugs and for breaks of this project's conventions. Report findings; do not edit code unless the user asks for fixes.

## 1. Work out what to review

- No argument: uncommitted work, `git diff HEAD` plus untracked files from `git status --porcelain`.
- A branch name: `git diff <default>...<branch>`. The default branch is `main`; if it doesn't exist locally, use `master` or ask.
- A range like `abc..def`: `git diff abc..def`.
- Paths: review those files as they are now.

If the diff is empty, say so and stop. Read every changed file in full, not only the hunks, and open whatever they call or are called by when a finding depends on it (for example `lib/server/http.js` for anything under `app/api`).

## 2. Checklist

Only report a point when the changed code actually breaks it. Each item says why it matters, so judge edge cases by the reason.

### API routes (`app/api/**/route.js`)

- **Wrapped in `route()`** from `#server/http.js`. Handlers return plain data and throw `HttpError` for expected failures. A bare `throw new Error` for a user mistake becomes a 500 with a generic message.
- **Correct options.** Anything touching a user's data needs `{ auth: true }`; admin endpoints need `{ role: 'admin' }`. Login, register, password-reset and other guessable endpoints need `limited: true`. `/api/cron/daily` must keep its `CRON_SECRET` bearer check and fail closed when the secret is unset.
- **GET exports `export const dynamic = 'force-dynamic'`.** Without it Next may prerender the route at build time and `route()`'s try/catch swallows the bailout.
- **Input validated with `parse(schema, …)`** (zod) for `body` and `query`: lengths, array sizes and enums bounded. No raw `ctx.body` spread into a Mongoose update, which allows mass assignment (`role`, `status`, `sessionVersion`, `passwordHash`, `userId`).
- **Ids checked** with `mongoose.isValidObjectId` before querying by `_id`, answering 404, otherwise a CastError becomes a 500. Note `UserJob.jobId` and `Job._id` are strings, not ObjectIds.
- **Per-user scoping.** Every `UserJob`/`Profile` query or update by id must also filter on `userId: user._id`; a lookup by `_id` alone lets one user read or change another's data.
- **No secrets in responses.** `ctx.user` is loaded with `+passwordHash`; return `user.toPublic()` (or explicit fields), never the document itself. The same goes for reset code and token hashes.
- **Long work** (fetching sources, matching every user) sets `maxDuration` like the existing routes, and stays within serverless time limits.

### Server code and imports

- Route files import server code as `#server/...`, never `@/…` or relative paths into `lib/server`.
- Nothing under `lib/server/` or `app/api/` imports `next/*` (`NextResponse`, `next/headers`, `cookies()`…). Use standard `Request`/`Response`. Tests import route files under plain Node, which can't resolve these.
- New models use `mongoose.models.X || mongoose.model('X', schema)` and are exported from `lib/server/models/index.js`. Queries that need it have an index (compare with the existing `schema.index` calls).
- No platform-only APIs (Vercel-specific packages, edge-only globals) and no file writes outside what already exists; the app must stay host-independent.

### Auth and sessions

- `requireAuth` must keep reloading the user on every request and comparing `sv` with `user.sessionVersion`. Password changes, resets and anything meant to log a user out everywhere bump `sessionVersion`.
- `proxy.js` is only a redirect convenience. Flag any change that relies on it, or on hiding UI, for access control.
- Cookie flags stay `HttpOnly; SameSite=Lax`, plus `Secure` in production.
- Only JSON bodies are read (CSRF defence in `readBody`); flag changes that start accepting form posts.

### Forgot password (`lib/server/services/passwordReset.js` and its routes)

- Responses and timing must not reveal whether an account exists.
- Code and token are stored only as hashes and compared with constant-time helpers. Codes are single-use with a guess limit and expiry; a correct code is consumed and swapped for the token.
- Without `SMTP_HOST`, dev logs the code and production returns 503. It must never log the code in production.

### Job flow

- `fetchJobs` respects per-source `minIntervalHours` stored in `SourceFetch`; a new trigger must not bypass the throttle (live search stays throttled per user).
- `matchUser` must never overwrite `status` or `notes` (use `$setOnInsert` for those), and may only delete untouched rows (`status: 'new'`, empty notes).
- New sources follow the contract at the top of `lib/server/services/sources/index.js` (separate `fetchRaw`/`parse`, stable `sourceId`, polite delays), work under `SOURCES_DEMO=1` with a fixture in `test/fixtures/`, and the fixture path is covered by `outputFileTracingIncludes` in `next.config.mjs`.
- Scoring changes in `score.js` come with updates to `test/score.test.js`.

### Logging

- Server code uses `logger` from `lib/server/logger.js`, not `console` (CLI scripts in `scripts/` are fine).
- Errors are passed as `{ err }`. Secrets go in fields whose names are redacted (`password`, `token`, `secret`, …), never interpolated into the message string or put under an unredacted key; redaction only reaches one level deep.
- Request logs keep to the path only: no query strings, bodies, search terms or emails in log messages.
- No pino transports.

### Frontend (`app/(app)`, `app/(auth)`, `components/`)

- Pages fetch through `lib/api.js` (`api`, `fetcher`) with SWR and get the user from `useSession()` in `components/AppShell.js`.
- A form filled from `useSWR` waits for `!isValidating` before copying data into state, and updates the SWR cache (`mutate`) after saving. Otherwise stale cache data from an earlier visit overwrites the form or the saved values reappear (see `app/(app)/profile/page.js`).
- Password fields use `components/PasswordInput.js`.
- `ApiError.fields` are shown next to the right inputs; loading, error and empty states are handled.
- No `dangerouslySetInnerHTML` with job data (descriptions come from third-party boards). External job links use `rel="noopener noreferrer"` and are http(s) only.
- Client components don't import anything from `lib/server`.

### Tests

- Behaviour changes in API routes or services have a test in `test/`, using `client(ip)`/`dispatch()` from `test/helpers.js`, with `helpers.js` imported before anything that loads the logger.
- Tests making many rate-limited calls use their own `client('10.x.x.x')`.
- Tests never use `.env`'s database.

### Docs

- New env vars appear in `.env.example` and `README.md`. Changes to commands, architecture or conventions are reflected in `CLAUDE.md`/`README.md`.

### General correctness

Beyond the checklist, look for ordinary bugs: unawaited promises, races between concurrent requests (prefer atomic `findOneAndUpdate`/`$inc` over read-modify-write), wrong status codes, unbounded queries or result sizes (paging limits), N+1 queries in loops, timezone and date errors, and null handling on data from external job boards.

## 3. Verify

- Run `npm test` when the diff touches `lib/server`, `app/api` or `test/`. Report failures with their output. It never touches the real database.
- Suggest `npm run build` (don't run it unprompted unless the change touches route exports, `next.config.mjs`, `proxy.js` or imports, since bundling problems only show up there). Don't start `npm run dev` for a review; if a live check is needed, follow the port-3000 safety steps in `CLAUDE.md`.
- Before reporting, re-read the code behind each finding and drop any you can't back with a concrete scenario.

## 4. Report

Group findings by severity, most severe first:

- **Must fix**: bugs, security or data-leak issues, broken invariants.
- **Should fix**: convention breaks with real consequences, missing tests for changed behaviour.
- **Consider**: smaller cleanups. Keep this short.

For each finding give `path:line`, one sentence on what's wrong, and the concrete scenario (input or state → wrong result). Suggest the fix in a line or a short snippet. End with the test result and a one-line verdict (ready / ready after fixes / needs rework). If nothing is wrong, say so plainly rather than padding the list.
