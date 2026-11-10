/* =====================================================================
   TEXT CHECKS
   Small helpers for checking text that people send us.
   ===================================================================== */

// Characters you can't see: spaces, tabs, line breaks, and invisible ones
// like the "zero-width space" (it takes up no room but is still a character)
const INVISIBLE = /[\s­​-‏⁠﻿]/g;

// True when nothing visible is left (only spaces or invisible characters)
export function isBlank(text) {
  return text.replace(INVISIBLE, '') === '';
}

// True when the text has hidden control codes (like the "null" character,
// a tab or a line break), which have no place in names and the like
export function hasControlChars(text) {
  return /[\u0000-\u001F\u007F-\u009F]/.test(text);
}
