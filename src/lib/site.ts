/* =====================================================================
   WHERE THE WEBSITE LIVES
   The web address of the WUBRG'r website, written ONCE here so every
   place that shows or links to it (Settings → About, Help, shared Card
   Finder links) stays the same. If the website ever moves, change these
   two lines (and "baseUrl" in app.json, which is the folder name the
   website is built to live in).
   Plain TypeScript with no React in it.
   ===================================================================== */

// The full address, with https:// and a / on the end
export const SITE_URL = 'https://navypirate83.com/wubrgr/';

// The same without https:// and without the / on the end, for showing
// to people ("navypirate83.com/wubrgr")
export const SITE_NAME = SITE_URL.replace(/^https:\/\//, '').replace(/\/$/, '');
