import mongoose from 'mongoose';
import { z } from 'zod';
import { UserJob } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';
import { STATUSES } from '#server/services/defaults.js';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({ status: z.enum(STATUSES).optional(), notes: z.string().max(5000).optional() });

export const GET = route(
  async ({ user, params }) => {
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, 'Job not found');
    const item = await UserJob.findOne({ _id: params.id, userId: user._id }).populate('jobId').lean();
    if (!item) throw new HttpError(404, 'Job not found');
    const { jobId: job, ...rest } = item;
    return { ...rest, jobId: job?._id, job };
  },
  { auth: true }
);

export const PATCH = route(
  async ({ user, params, body: raw }) => {
    const body = parse(patchSchema, raw);
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, 'Job not found');
    const update = { ...body };
    if (body.status) update.statusChangedAt = new Date();
    const item = await UserJob.findOneAndUpdate({ _id: params.id, userId: user._id }, update, { returnDocument: 'after' }).lean();
    if (!item) throw new HttpError(404, 'Job not found');
    return item;
  },
  { auth: true }
);
