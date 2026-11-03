// Promote (or create) an admin.  npm run seed:admin -- you@example.com [password]
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../lib/server/db.js';
import { User, Profile } from '../lib/server/models/index.js';
import { SUGGESTED_SKILLS } from '../lib/server/services/defaults.js';

const [email, password] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run seed:admin -- <email> [password]');
  process.exit(1);
}

await connectDb();
let user = await User.findOne({ email: email.toLowerCase() });
if (user) {
  user.role = 'admin';
  user.status = 'active';
  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  console.log(`${email} is now an admin.`);
} else {
  if (!password) {
    console.error('No user with that email. Pass a password to create one.');
    process.exit(1);
  }
  user = await User.create({ name: email.split('@')[0], email, passwordHash: await bcrypt.hash(password, 10), role: 'admin' });
  await Profile.create({ userId: user._id, skills: SUGGESTED_SKILLS });
  console.log(`Created admin ${email}.`);
}
await mongoose.disconnect();
