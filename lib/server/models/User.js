import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, index: true, sparse: true },
    avatar: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    lastLoginAt: Date,
    lastLiveSearchAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  const { _id, name, email, avatar, role, status, createdAt, lastLoginAt } = this;
  return { id: String(_id), name, email, avatar, role, status, createdAt, lastLoginAt, hasPassword: !!this.passwordHash };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
