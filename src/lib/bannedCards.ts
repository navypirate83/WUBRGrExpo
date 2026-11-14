/* =====================================================================
   BANNED CARDS
   Every format has a list of cards that aren't allowed in it. Scryfall can
   give us that list ("banned:commander" finds every card banned in
   Commander), so the first time a deck of a format needs it, it's asked
   for once and remembered until the app closes. A deck then uses it to:
     - warn when you add a banned card, and
     - draw a black "BANNED" slash across a banned card's picture.
   (Only cards that are banned count: a card that is simply not in a
   format's card pool isn't marked.)
   ===================================================================== */

import { useEffect, useState } from 'react';
import { searchAllCards } from './scryfall';

// The banned names for each format code, once they've arrived (lowercase)
const known = new Map<string, Set<string>>();
// Lookups still on their way, so two askers share one request
const asking = new Map<string, Promise<Set<string>>>();

// A card's name as it's compared: lowercase. Two-sided cards are known by
// both names ("a // b") and by their front side, so any of them matches.
function namesOf(name: string): string[] {
  const full = name.trim().toLowerCase();
  return [full, ...full.split(' // ')];
}

// The banned list for a format: from memory if we have it, else from Scryfall
export function loadBanned(formatCode: string): Promise<Set<string>> {
  const have = known.get(formatCode);
  if (have) return Promise.resolve(have);
  let pending = asking.get(formatCode);
  if (!pending) {
    pending = searchAllCards(`banned:${formatCode}`)
      .then((cards) => {
        const names = new Set<string>();
        for (const card of cards) namesOf(card.name).forEach((n) => names.add(n));
        known.set(formatCode, names);
        return names;
      })
      .finally(() => asking.delete(formatCode));
    asking.set(formatCode, pending);
  }
  return pending;
}

// Is this card banned in this format? (The list has to have been loaded
// already, which "useBanned" or "loadBanned" does; until then: no.)
export function isBannedNow(formatCode: string, name: string): boolean {
  const names = known.get(formatCode);
  return names ? namesOf(name).some((n) => names.has(n)) : false;
}

// Is this card banned in this format? Asks Scryfall if it has to. If Scryfall
// can't be reached, the answer is "no" (a banned-card warning is a courtesy,
// so it shouldn't stop you adding cards).
export async function isBanned(formatCode: string, name: string): Promise<boolean> {
  try {
    const names = await loadBanned(formatCode);
    return namesOf(name).some((n) => names.has(n));
  } catch {
    return false;
  }
}

// For a screen: the format's banned list, loaded as soon as the screen needs
// it. Gives back a function that says whether a card name is banned (it
// says "no" until the list arrives, then the screen redraws with the marks).
export function useBanned(formatCode: string): (name: string) => boolean {
  const [names, setNames] = useState<Set<string> | undefined>(known.get(formatCode));
  useEffect(() => {
    let stale = false;
    setNames(known.get(formatCode));
    loadBanned(formatCode).then((set) => { if (!stale) setNames(set); }).catch(() => { /* no marks if it can't be loaded */ });
    return () => { stale = true; };
  }, [formatCode]);
  return (name: string) => (names ? namesOf(name).some((n) => names.has(n)) : false);
}
