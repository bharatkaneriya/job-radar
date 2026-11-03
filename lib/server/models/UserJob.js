import mongoose from 'mongoose';
import { STATUSES } from '../services/defaults.js';

// A job matched to a user, with their score and tracking status.
const userJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: String, ref: 'Job', required: true },
    score: Number,
    matched: [String],
    flags: [String],
    status: { type: String, enum: STATUSES, default: 'new' },
    notes: { type: String, default: '' },
    statusChangedAt: Date,
    firstSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
userJobSchema.index({ userId: 1, status: 1, score: -1 });

export const UserJob = mongoose.models.UserJob || mongoose.model('UserJob', userJobSchema);
