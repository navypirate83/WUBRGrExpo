/* =====================================================================
   TEST SETUP
   Runs before every test file. It reads the .env file (for the
   database address), then sets the values the tests need: a FAKE login
   secret (so the real one is never used) and very high rate limits
   (the tests send many requests very quickly).
   ===================================================================== */

import dotenv from 'dotenv';

// Read .env first (dotenv never replaces a value that is already set)
dotenv.config({ quiet: true });

// A fake secret, only for tests
process.env.JWT_SECRET = 'test-only-secret-not-the-real-one';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.SCRYFALL_RATE_LIMIT_MAX = '100000';
// The tests use a few fixed website addresses
process.env.CORS_ORIGINS = 'https://navypirate83.github.io,http://localhost:8081';
// Google sign-in is not set up in tests (it would call Google)
process.env.GOOGLE_CLIENT_ID = '';
