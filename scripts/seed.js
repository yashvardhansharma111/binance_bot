import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trickyx';

const ADMIN_EMAIL = 'admin@trickyx.ai';
const ADMIN_PASSWORD = 'Admin@123';
const ADMIN_NAME = 'Admin';

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, default: 'user' },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  fundBalance: { type: Number, default: 0 },
  assetBalance: { type: Number, default: 0 },
  minAssetRequired: { type: Number, default: 100 },
  botActive: { type: Boolean, default: false },
  status: { type: String, default: 'active' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const exists = await User.findOne({ email: ADMIN_EMAIL });
  if (exists) {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hashed,
    role: 'admin',
    referralCode: 'ADMIN0000',
    status: 'active',
  });

  console.log('');
  console.log('✓ Admin user created');
  console.log(`  Email    : ${ADMIN_EMAIL}`);
  console.log(`  Password : ${ADMIN_PASSWORD}`);
  console.log('');

  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
