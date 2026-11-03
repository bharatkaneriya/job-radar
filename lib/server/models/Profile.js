import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    headline: { type: String, default: '' },
    experienceYears: { type: Number, default: 0 },
    skills: [{ _id: false, name: String, weight: { type: Number, min: 1, max: 10, default: 5 } }],
    preferences: {
      includeKeywords: [String],
      excludeKeywords: [String],
      preferredLocations: [String],
      remoteOnly: { type: Boolean, default: true },
      jobTypes: [{ type: String, enum: ['full-time', 'part-time', 'contract', 'freelance'] }],
      minScore: { type: Number, default: 15 },
      maxAgeDays: { type: Number, default: 14 },
    },
    sources: [String], // empty = all enabled sources
    completed: { type: Boolean, default: false },
    lastMatchedAt: Date,
  },
  { timestamps: true }
);

export const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);
