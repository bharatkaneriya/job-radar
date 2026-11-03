import mongoose from 'mongoose';

// Last fetch per source. Replaces the old data/cache files and enforces each
// source's minIntervalHours across all users and serverless instances.
const sourceFetchSchema = new mongoose.Schema({
  _id: String, // source name
  fetchedAt: Date,
  ok: Boolean,
  count: Number,
  error: String,
  durationMs: Number,
});

export const SourceFetch = mongoose.models.SourceFetch || mongoose.model('SourceFetch', sourceFetchSchema);
