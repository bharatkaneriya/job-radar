import { z } from 'zod';
import { Profile } from '#server/models/index.js';
import { route, parse } from '#server/http.js';
import { matchUser } from '#server/services/matchUser.js';
import { SOURCES } from '#server/services/sources/index.js';
import { SUGGESTED_SKILLS } from '#server/services/defaults.js';
import { sourceList } from '#server/services/fetchJobs.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const words = z.array(z.string().trim().min(1).max(60)).max(50).default([]);
const profileSchema = z.object({
  headline: z.string().trim().max(200).default(''),
  experienceYears: z.coerce.number().min(0).max(60).default(0),
  skills: z
    .array(z.object({ name: z.string().trim().min(1).max(60), weight: z.coerce.number().int().min(1).max(10) }))
    .min(1, 'Add at least one skill')
    .max(60),
  preferences: z.object({
    includeKeywords: words,
    excludeKeywords: words,
    preferredLocations: words,
    remoteOnly: z.boolean().default(true),
    jobTypes: z.array(z.enum(['full-time', 'part-time', 'contract', 'freelance'])).default([]),
    minScore: z.coerce.number().int().min(-50).max(200).default(15),
    maxAgeDays: z.coerce.number().int().min(1).max(60).default(14),
  }),
  sources: z.array(z.string().refine((s) => SOURCES[s], 'Unknown source')).default([]),
});

export const GET = route(
  async ({ user }) => {
    const profile = await Profile.findOne({ userId: user._id }).lean();
    return { profile, suggestedSkills: SUGGESTED_SKILLS, sources: sourceList() };
  },
  { auth: true }
);

export const PUT = route(
  async ({ user, body }) => {
    const data = parse(profileSchema, body);
    const profile = await Profile.findOneAndUpdate(
      { userId: user._id },
      { ...data, completed: true },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    ).lean();
    const match = await matchUser(user._id, profile);
    return { profile, match };
  },
  { auth: true }
);
