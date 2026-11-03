import { route, HttpError } from '#server/http.js';
import { fetchJobs } from '#server/services/fetchJobs.js';
import { matchAllUsers } from '#server/services/matchAll.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
export const GET = route(async ({ req }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'Unauthorized');
  const sources = await fetchJobs();
  const match = await matchAllUsers();
  return { sources, match };
});
