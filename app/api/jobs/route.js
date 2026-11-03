import { route, parse } from '#server/http.js';
import { listJobs, listSchema } from '#server/services/listJobs.js';

export const dynamic = 'force-dynamic';

// DB mode: the user's stored matches.
export const GET = route(({ user, query }) => listJobs(user._id, parse(listSchema, query)), { auth: true });
