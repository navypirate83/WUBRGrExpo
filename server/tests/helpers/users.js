/* =====================================================================
   TEST USERS
   Helpers that make fake users (only in the test database, which is
   emptied after every test) and the login token for them.
   ===================================================================== */

import jwt from 'jsonwebtoken';
import User from '../../models/User.js';

// A fake password used by every test user
export const TEST_PASSWORD = 'test-pass-123';

let counter = 0;

// Makes a user directly with the model (so the password is scrambled)
export async function makeUser(overrides = {}) {
  counter += 1;
  return User.create({
    email: `person${counter}@example.com`,
    name: `Person ${counter}`,
    password: TEST_PASSWORD,
    ...overrides,
  });
}

// A login token for a user, signed with the test secret
export function tokenFor(user, options = { expiresIn: '15m' }) {
  return jwt.sign({ sub: String(user._id), email: user.email, role: user.role }, process.env.JWT_SECRET, options);
}

// The header an app sends: "Authorization: Bearer <token>"
export function bearer(user) {
  return `Bearer ${tokenFor(user)}`;
}

// A good card for a binder, with the given place
export function aCard(page = 1, pocket = 1, extra = {}) {
  return {
    page,
    pocket,
    name: `Test Card ${page}-${pocket}`,
    set: 'lea',
    number: '1',
    face: 0,
    image: 'https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg',
    ...extra,
  };
}
