/* =====================================================================
   TEST DATABASE HELPERS
   Tests NEVER touch the real data. They use a separate database whose
   name ends in "test", and a safety lock refuses to run (or to empty
   anything) on any other database. Only our own "wubrgr_" collections
   are ever emptied.
   ===================================================================== */

import mongoose from 'mongoose';
import '../../models/User.js';
import '../../models/RefreshToken.js';
import '../../models/PasswordReset.js';
import '../../models/Binder.js';
import '../../models/Card.js';
import '../../models/List.js';
import '../../models/ListCard.js';
import '../../models/ScryfallCache.js';

// The safety lock: stop unless we're connected to a "...test" database
function assertTestDatabase() {
  const name = mongoose.connection.name;
  if (typeof name !== 'string' || !name.endsWith('test')) {
    throw new Error(`Refusing to run tests on the database "${name}": its name must end with "test"`);
  }
}

// Connect to the test database and make sure its unique rules exist
export async function connectTestDb() {
  const uri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri, { dbName: process.env.TEST_DB_NAME || 'wubgr-test' });
  assertTestDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

// Empty ONLY our "wubrgr_" collections (keeps their indexes)
export async function clearTestDb() {
  assertTestDatabase();
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const { name } of collections) {
    if (name.startsWith('wubrgr_')) await mongoose.connection.db.collection(name).deleteMany({});
  }
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}
