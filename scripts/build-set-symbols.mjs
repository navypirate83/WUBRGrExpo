/* =====================================================================
   BUILD THE SET SYMBOL LIST (run by hand, now and then)
   Scryfall has about 1,000 sets, but many of them share one and the same
   symbol picture (Secret Lair and Pro Tour Promos, for example, use the
   very same starburst). The "Set symbols" list on a binder's cover should
   show each picture only once, so this script:
     1. gets Scryfall's list of sets, and every set's symbol picture
     2. leaves out the Alchemy and MTG Arena sets (not wanted on covers)
     3. groups the sets whose pictures are exactly the same
     4. gives each group a name (see nameFor below)
     5. writes the result to src/data/setSymbols.ts, newest first
   The pictures themselves are NOT kept in the app: the app fetches them
   from Scryfall when it needs them. Only this small list of names is kept.
   Run it from the project folder with:  node scripts/build-set-symbols.mjs
   It takes a minute or two (it's polite to Scryfall: a few downloads at a
   time). To reuse pictures already downloaded, pass a folder holding
   "sets.json" and "svg/<code>.svg":  --cache <folder>
   ===================================================================== */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Scryfall asks every program to say who it is
const HEADERS = { 'User-Agent': 'WUBRGr/0.2 (+https://github.com/navypirate83/wubrgr)', Accept: 'application/json' };

// Where the result goes
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'setSymbols.ts');

// An optional folder of pictures already downloaded
const cacheFlag = process.argv.indexOf('--cache');
const CACHE = cacheFlag > -1 ? process.argv[cacheFlag + 1] : null;

/* ---------- which sets to leave out ---------- */

// Alchemy sets (the digital-only rebalanced cards) and MTG Arena's own
// sets (its beginner sets and anthologies) don't go on binder covers.
// "Arena League" is the old paper tournament promo series, not MTG Arena,
// so it stays.
function isLeftOut(set) {
  if (set.set_type === 'alchemy' || /alchemy/i.test(set.name)) return true;
  if (/^(Pioneer|Explorer) Anthology/i.test(set.name)) return true;
  return /arena/i.test(set.name) && !/arena league/i.test(set.name);
}

/* ---------- names chosen by hand ---------- */

// Groups made of unrelated sets (promos from all over, say) can't be named
// after one expansion, so they have names chosen by hand. The key is the
// name of the group's newest set.
const CHOSEN_NAMES = {
  'MagicFest 2027': 'Promos & Special Releases',
  'Judge Gift Cards 2011': 'Judge, FNM & Event Promos',
  'Nauctis: The Sunken Realm Tokens': 'Convention Promos, Tokens & Collector Sets',
  'Historic Anthology 7': 'Historic Anthology',
  'Modern Horizons 2 Timeshifts': 'Modern Horizons 2',
  'Black Lotus Unknown Planechase': 'The List & Playtest Cards',
  'Modern Horizons 1 Timeshifts': 'Modern Horizons',
  'Hachette UK': 'Hachette UK & Salvat',
  'Magic Online Avatars': 'Magic Online Promos & Avatars',
  'Duels of the Planeswalkers': 'Duels of the Planeswalkers',
};

// The big catch-all groups sort to the END of the list (their newest set
// is a far-future promo, which would otherwise put them at the very top)
const CATCH_ALLS = new Set([
  'Promos & Special Releases', 'Judge, FNM & Event Promos',
  'Convention Promos, Tokens & Collector Sets', 'The List & Playtest Cards',
]);

/* ---------- getting the data ---------- */

async function getSets() {
  if (CACHE) return JSON.parse(await readFile(join(CACHE, 'sets.json'), 'utf8')).data;
  const reply = await fetch('https://api.scryfall.com/sets', { headers: HEADERS });
  if (!reply.ok) throw new Error(`Scryfall said ${reply.status} for the list of sets`);
  return (await reply.json()).data;
}

// One set's symbol picture, as text
async function getPicture(set) {
  if (CACHE) return readFile(join(CACHE, 'svg', `${set.code}.svg`), 'utf8');
  const reply = await fetch(set.icon_svg_uri, { headers: HEADERS });
  if (!reply.ok) throw new Error(`Scryfall said ${reply.status} for ${set.code}'s symbol`);
  return reply.text();
}

// Run a job for every item, a few at a time, with a short pause (polite)
async function inBatches(items, size, job) {
  const results = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...await Promise.all(items.slice(start, start + size).map(job)));
    if (!CACHE) await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return results;
}

// A fingerprint of a picture that ignores spacing and comments, so two
// copies of the same drawing match even if written slightly differently
function fingerprint(svg) {
  const plain = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  return createHash('sha256').update(plain).digest('hex');
}

/* ---------- naming a group ---------- */

// Sets that are the main release of an expansion (not tokens or promos)
const MAIN_TYPES = new Set(['core', 'expansion', 'draft_innovation']);

function nameFor(members, byCode) {
  // One set alone: its own name
  if (members.length === 1) return members[0].name;
  // Chosen by hand?
  if (CHOSEN_NAMES[members[0].name]) return CHOSEN_NAMES[members[0].name];
  // A set's "root": its parent set, if it has one (tokens, promos and art
  // series point at the expansion they belong to)
  const rootOf = (set) => {
    let code = set.code;
    for (let step = 0; step < 5 && byCode.get(code)?.parent_set_code; step += 1) code = byCode.get(code).parent_set_code;
    return code;
  };
  const roots = new Set(members.map(rootOf));
  // All from one expansion: that expansion's name
  if (roots.size === 1) return byCode.get([...roots][0])?.name ?? members[0].name;
  // Exactly one main release among them: its name
  const mains = members.filter((set) => MAIN_TYPES.has(set.set_type));
  if (mains.length === 1) return mains[0].name;
  // Duel decks: the original "Duel Decks: X vs. Y" name
  const duel = members.find((set) => set.set_type === 'duel_deck' && set.name.startsWith('Duel Decks: '));
  if (duel) return duel.name;
  // Sets named for a year ("Judge Gift Cards 2020" ...): the name with the years
  const noYear = new Set(members.map((set) => set.name.replace(/\s*\d{4}$/, '')));
  if (noYear.size === 1 && members.every((set) => /\d{4}$/.test(set.name))) {
    const years = members.map((set) => set.name.match(/(\d{4})$/)[1]).sort();
    return `${[...noYear][0]} ${years[0]}–${years[years.length - 1]}`;
  }
  return members[0].name;
}

/* ---------- running it ---------- */

const allSets = await getSets();
const byCode = new Map(allSets.map((set) => [set.code, set]));
// Newest first, so each group's first member is its newest
const wanted = allSets.filter((set) => !isLeftOut(set))
  .sort((a, b) => b.released_at.localeCompare(a.released_at));
console.log(`${allSets.length} sets, ${allSets.length - wanted.length} left out, ${wanted.length} to group`);

const pictures = await inBatches(wanted, 4, getPicture);
const groups = new Map();
wanted.forEach((set, index) => {
  const key = fingerprint(pictures[index]);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(set);
});

// One name per group. An expansion can have more than one picture (its
// main set and its Commander set, say) and so more than one group with the
// same name. The group that holds the expansion itself keeps the plain
// name; the others get their set code added, like "Foundations (TFDC)", so
// no two rows in the list look the same.
const groupList = [...groups.values()];
const plainNames = groupList.map((members) => nameFor(members, byCode));
const timesUsed = new Map();
plainNames.forEach((name) => timesUsed.set(name, (timesUsed.get(name) ?? 0) + 1));
const finalNames = groupList.map((members, index) => {
  const name = plainNames[index];
  if (timesUsed.get(name) === 1) return name;
  return members.some((set) => set.name === name) ? name : `${name} (${members[0].code.toUpperCase()})`;
});

// One entry per group
const entries = groupList.map((members, index) => {
  const name = finalNames[index];
  return {
    code: members[0].code,
    name,
    date: CATCH_ALLS.has(name) ? '0000-00-00' : members[0].released_at,
    codes: members.map((set) => set.code),
    search: [...new Set(members.flatMap((set) => [set.name, set.code]))].join('|').toLowerCase(),
  };
}).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));

console.log(`${entries.length} different symbols`);

/* ---------- writing the file ---------- */

const lines = entries.map((entry) => `  ${JSON.stringify(entry)},`).join('\n');
const file = `/* =====================================================================
   THE SET SYMBOL LIST (made by scripts/build-set-symbols.mjs: don't edit)
   Every set symbol a binder cover can use, each picture ONCE (sets that
   share a picture are one entry), newest first. Alchemy and MTG Arena
   sets are left out.
   - code: the set the picture is fetched for (any set in the group would
     do: they look the same). This is what a binder remembers, as
     "set:" plus the code.
   - name: what the list shows
   - date: when the newest set in the group came out (for the order)
   - codes: every set code in the group, so a binder that remembers any
     of them finds its entry
   - search: all the group's set names and codes, in lower case, so
     typing any of them finds the entry
   Built ${new Date().toISOString().slice(0, 10)} from ${allSets.length} sets.
   ===================================================================== */

export type SetSymbolEntry = { code: string; name: string; date: string; codes: string[]; search: string };

export const SET_SYMBOLS: SetSymbolEntry[] = [
${lines}
];
`;
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, file, 'utf8');
console.log(`Wrote ${OUTPUT}`);
