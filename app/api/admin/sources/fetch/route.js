import { z } from 'zod';
import { route, parse } from '#server/http.js';
import { fetchJobs } from '#server/services/fetchJobs.js';
import { matchAllUsers } from '#server/services/matchAll.js';

export const maxDuration = 60;

const fetchSchema = z.object({ force: z.boolean().default(false), only: z.array(z.string()).optional(), rematch: z.boolean().default(true) });

export const POST = route(
  async ({ body }) => {
    const { force, only, rematch } = parse(fetchSchema, body || {});
    const sources = await fetchJobs({ force, only });
    const match = rematch ? await matchAllUsers() : null;
    return { sources, match };
  },
  { role: 'admin' }
);
