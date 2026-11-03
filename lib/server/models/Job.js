import mongoose from 'mongoose';

// Shared pool: one row per post, fetched once for all users.
const jobSchema = new mongoose.Schema(
  {
    _id: String, // "<source>:<sourceId>"
    source: { type: String, index: true },
    sourceLabel: String,
    sourceHome: String,
    sourceId: String,
    title: String,
    company: String,
    url: String,
    location: String,
    tags: [String],
    description: String,
    postedAt: Date,
    salary: String,
    jobType: String,
    dedupeKey: { type: String, index: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

jobSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 60 * 864e2 }); // forget posts unseen for 60 days
jobSchema.index({ postedAt: -1 });

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
