/* =====================================================================
   INPUT CHECKS
   Every field that comes in from the outside gets checked here BEFORE
   it goes near the database. Each small check returns a message (what's
   wrong) or null (fine). The bigger functions at the bottom use them to
   check a whole binder or card, and return { error } or { value } where
   "value" holds only the fields we know about (never the raw request).
   One set of checks is used for both creating and updating, so the two
   can never drift apart.
   ===================================================================== */

import { isBlank, hasControlChars } from './text.js';
import { isGoodCover } from '../models/Binder.js';

/* ---------- small checks, one per kind of value ---------- */

// Text: must be a string, not blank, no hidden control codes, and the
// length (after trimming) within the limits
export function checkText(value, label, { min = 1, max, allowEmpty = false } = {}) {
  if (typeof value !== 'string') return `${label} must be text`;
  if (allowEmpty && value === '') return null;
  if (isBlank(value)) return `${label} can't be blank`;
  if (hasControlChars(value)) return `${label} has characters that aren't allowed`;
  const length = value.trim().length;
  if (length < min) return `${label} must be at least ${min} characters long`;
  if (length > max) return `${label} must be at most ${max} characters long`;
  return null;
}

// A whole number inside a range (a real number, not text like "5")
export function checkWhole(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return `${label} must be a whole number`;
  if (value < min || value > max) return `${label} must be between ${min} and ${max}`;
  return null;
}

// A true boolean: only the real true or false (not "yes", 1 or null)
export function checkBoolean(value, label) {
  return typeof value === 'boolean' ? null : `${label} must be true or false`;
}

// Is this a real calendar day? Building the date must not "roll over"
// (2026-02-31 would quietly become March 3, so we compare it back)
function isRealDay(year, month, day) {
  if (year < 1970 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// A date: exactly YYYY-MM-DD, or the full date and time the app saves
// (like 2026-10-19T21:46:35.638Z). It must be a real day between 1970 and 2100.
// We never trust new Date(text) alone, because it guesses ("5" becomes a date).
export function checkDate(value, label) {
  if (typeof value !== 'string') return `${label} must be a date written YYYY-MM-DD`;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z)?$/.exec(value);
  if (!match) return `${label} must be a date written YYYY-MM-DD`;
  const [, y, m, d, hh, mm, ss] = match;
  if (!isRealDay(Number(y), Number(m), Number(d))) return `${label} is not a real calendar day`;
  if (hh !== undefined && (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59)) return `${label} has an impossible time`;
  return null;
}

/* ---------- a whole binder ---------- */

// Checks a binder's fields. For a new binder every required field must be
// there; on an update ("partial"), fields not sent are skipped, but any
// field that IS sent must pass the same rules.
export function validateBinder(body, { partial = false } = {}) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const value = {};
  const has = (field) => input[field] !== undefined;

  if (has('name') || !partial) {
    const problem = checkText(input.name, 'Name', { min: 1, max: 12 });
    if (problem) return { error: problem };
    value.name = input.name.trim();
  }
  if (has('color')) {
    if (input.color !== null && (typeof input.color !== 'string' || !/^[A-Z]{1,2}$/.test(input.color))) {
      return { error: 'Color must be a mana symbol code like U or WB, or null' };
    }
    value.color = input.color;
  }
  if (has('cover')) {
    if (typeof input.cover !== 'string' || !isGoodCover(input.cover)) {
      return { error: 'Cover must be a color name or a #rrggbb code' };
    }
    value.cover = input.cover.toLowerCase();
  }
  if (has('pages')) {
    const problem = checkWhole(input.pages, 'Pages', 1, 100000);
    if (problem) return { error: problem };
    value.pages = input.pages;
  }
  if (has('pageLayout')) {
    if (typeof input.pageLayout !== 'string' || !/^[0-9]{1,2}x[0-9]{1,2}$/.test(input.pageLayout)) {
      return { error: 'Page layout must look like 4x4' };
    }
    value.pageLayout = input.pageLayout;
  }
  return { value };
}

/* ---------- one card ---------- */

// The most "extra" columns a card may carry, and how long each may be
const MAX_EXTRA_KEYS = 30;

// Checks a card's "extra" notes: a plain object of short text values
function checkExtra(extra) {
  if (extra === null || typeof extra !== 'object' || Array.isArray(extra)) return 'extra must be an object of text values';
  const keys = Object.keys(extra);
  if (keys.length > MAX_EXTRA_KEYS) return `extra can have at most ${MAX_EXTRA_KEYS} entries`;
  for (const key of keys) {
    // MongoDB can't store keys with "." or starting with "$", and these names are dangerous
    if (key === '' || key.length > 60 || /[.$]/.test(key) || key === '__proto__' || hasControlChars(key)) {
      return 'extra has a name that isn\'t allowed';
    }
    const problem = checkText(extra[key], `extra "${key}"`, { max: 200, allowEmpty: true });
    if (problem) return problem;
  }
  return null;
}

// Checks one card (the same rules for binder cards and list cards).
// "withPlace" also checks page and pocket (binder cards). Returns
// { error } or { value } with only the known fields.
export function validateCard(card, { withPlace = false } = {}) {
  if (card === null || typeof card !== 'object' || Array.isArray(card)) return { error: 'must be an object' };
  const value = {};

  if (withPlace) {
    const page = checkWhole(card.page, 'page', 1, 1000000);
    if (page) return { error: page };
    const pocket = checkWhole(card.pocket, 'pocket', 1, 1000);
    if (pocket) return { error: pocket };
    value.page = card.page;
    value.pocket = card.pocket;
  }

  const name = checkText(card.name, 'name', { min: 1, max: 200 });
  if (name) return { error: name };
  value.name = card.name.trim();

  // set and number may be empty (a card without a known printing)
  const set = checkText(card.set ?? '', 'set', { max: 10, allowEmpty: true });
  if (set) return { error: set };
  value.set = (card.set ?? '').trim().toLowerCase();

  const number = checkText(card.number ?? '', 'number', { max: 20, allowEmpty: true });
  if (number) return { error: number };
  value.number = (card.number ?? '').trim();

  if (card.face !== undefined && card.face !== 0 && card.face !== 1) return { error: 'face must be 0 (front) or 1 (back)' };
  value.face = card.face ?? 0;

  // The picture must be an https address
  const image = checkText(card.image, 'image', { max: 500 });
  if (image) return { error: image };
  if (!/^https:\/\/[^\s]+$/.test(card.image)) return { error: 'image must be an https address' };
  value.image = card.image;

  if (card.lang !== undefined) {
    const lang = checkText(card.lang, 'lang', { max: 10 });
    if (lang) return { error: lang };
    value.lang = card.lang.trim();
  }
  if (card.count !== undefined) {
    const count = checkWhole(card.count, 'count', 1, 99);
    if (count) return { error: count };
    value.count = card.count;
  }
  if (card.foil !== undefined) {
    const foil = checkBoolean(card.foil, 'foil');
    if (foil) return { error: foil };
    value.foil = card.foil;
  }
  if (card.added !== undefined) {
    const added = checkDate(card.added, 'added');
    if (added) return { error: added };
    value.added = new Date(card.added);
  }
  if (card.extra !== undefined) {
    const extra = checkExtra(card.extra);
    if (extra) return { error: extra };
    value.extra = card.extra;
  }
  return { value };
}

// Checks a list card: a card plus its mana cost and type line (position is
// set by the server from the card's place in the list)
export function validateListCard(card) {
  const result = validateCard(card);
  if (result.error) return result;
  for (const [field, max] of [['manaCost', 100], ['typeLine', 200]]) {
    if (card[field] !== undefined) {
      const problem = checkText(card[field], field, { max, allowEmpty: true });
      if (problem) return { error: problem };
      result.value[field] = card[field];
    }
  }
  return result;
}

// Checks a list's name (1 to 100 characters)
export function validateListName(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const problem = checkText(input.name, 'Name', { min: 1, max: 100 });
  return problem ? { error: problem } : { value: { name: input.name.trim() } };
}

// The most cards one binder may hold (a safety cap)
export const MAX_CARDS_PER_BINDER = 50000;
