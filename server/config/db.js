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

// Connect to MongoDB and say clearly whether it worked
export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connection SUCCESS');
  } catch (err) {
    // Only the short reason is printed, never the address with its password
    console.error('MongoDB connection FAILED:', err.name);
    process.exit(1);
  }
}
