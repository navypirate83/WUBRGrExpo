/* =====================================================================
   NARROWING A BINDER OR LIST TO THE CARDS YOU'RE SEARCHING FOR
   As you type in a binder's or list's search box, only the cards whose
   NAME matches are kept, with the same forgiving search as the Card Finder
   (part of a name, any spacing or punctuation, small typos). It starts
   once two letters are typed; before that, every card is kept.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { fuzzySearch, prepareNames, simplify } from './nameSearch';

// Start narrowing once this many letters are typed
export const SEARCH_MIN_CHARS = 2;

// Is something long enough typed to search for?
export function isSearching(text: string): boolean {
  return text.trim().length >= SEARCH_MIN_CHARS;
}

// Make a filter for these items. The names are prepared once (the slow
// part), so the filter it gives back is quick to call on every key press:
// it returns the items whose name matches the text (all of them while
// nothing is being searched for), in their original order.
export function makeNameFilter<T>(items: T[], nameOf: (item: T) => string): (text: string) => T[] {
  const prepared = prepareNames([...new Set(items.map(nameOf))]);
  return (text) => {
    if (!isSearching(text)) return items;
    const matching = new Set(fuzzySearch(prepared, text));
    return items.filter((item) => matching.has(nameOf(item)));
  };
}

// Is the text typed exactly one of these names (ignoring capitals, accents,
// spacing and punctuation)? Then there's nothing to suggest.
export function isExactName(names: string[], text: string): boolean {
  const typed = simplify(text);
  return typed !== '' && names.some((name) => simplify(name) === typed);
}
