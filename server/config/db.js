/* =====================================================================
   SETTINGS AND THE DATABASE CONNECTION
   loadConfig() reads the settings from the ".env" file (secrets stay
   out of the code). connectDB() connects to MongoDB using the address
   in MONGODB_URI. The address is never written in the code itself.
   ===================================================================== */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Read the ".env" file once. In test mode, stay quiet so test output is tidy.
// Returns the settings the rest of the server needs.
export function loadConfig() {
  dotenv.config({ quiet: process.env.NODE_ENV === 'test' });

  // A whole number from the settings, or a default if it's missing or odd
  const number = (value, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };

  return {
    port: number(process.env.PORT, 4000),
    // The exact websites allowed to call us from a browser. Blank = none.
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address !== '' && address !== '*'),
    // How many requests one visitor may make per minute
    rateLimitMax: number(process.env.RATE_LIMIT_MAX, 100),
    // How many tries one visitor gets per minute on the sign-in routes
    authRateLimitMax: number(process.env.AUTH_RATE_LIMIT_MAX, 5),
  };
}

// Describe a MongoDB address WITHOUT revealing any secret part: does it
// start correctly, is there a user and password, a database name, stray
// quotes or spaces? Used only to help fix a bad MONGODB_URI setting.
function describe(uri) {
  if (!uri) return 'MONGODB_URI is empty or missing';
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const atCount = (uri.match(/@/g) ?? []).length;
  const dbName = afterScheme.split('@').pop().split('?')[0].split('/')[1] ?? '';
  return JSON.stringify({
    length: uri.length,
    startsCorrectly: /^mongodb(\+srv)?:\/\//.test(uri),
    hasQuotesOrSpaces: /["'\s]/.test(uri),
    startsWithName: /^MONGODB_URI\s*=/i.test(uri),
    atSigns: atCount,
    hasUserAndPassword: /^[^:@/]+:[^@]+@/.test(afterScheme),
    hasDatabaseName: dbName !== '',
  });
}

// Connect to MongoDB and say clearly whether it worked
export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connection SUCCESS');
  } catch (err) {
    // Print the reason, but never the address or its password. The message
    // has the address blanked out, and describe() shows only the "shape"
    // of the address (not its secret parts) so a typo can be spotted.
    const uri = process.env.MONGODB_URI ?? '';
    const safeMessage = uri ? String(err.message).split(uri).join('[address hidden]') : String(err.message);
    console.error('MongoDB connection FAILED:', err.name, '-', safeMessage);
    console.error('Address shape:', describe(uri));
    process.exit(1);
  }
}
