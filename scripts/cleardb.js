/**
 * Clear all collections except admin user.
 * Run: node scripts/cleardb.js
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trickyx';
const ADMIN_EMAIL = 'boby.soni1997@gmail.com';

async function clearDB() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    if (name === 'users') {
      // Keep admin, delete everyone else
      const result = await db.collection('users').deleteMany({
        email: { $ne: ADMIN_EMAIL },
      });
      console.log(`✓ users — deleted ${result.deletedCount} (admin kept)`);
    } else {
      const result = await db.collection(name).deleteMany({});
      console.log(`✓ ${name} — deleted ${result.deletedCount}`);
    }
  }

  console.log('\nDatabase cleared. Admin account preserved.');
  await mongoose.disconnect();
}

clearDB().catch(e => { console.error(e); process.exit(1); });
