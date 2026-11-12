/* =====================================================================
   THE PRICES OF A BINDER'S CARDS
   Looks up what each card in a binder costs at the store chosen in
   Settings (the "price store"), and adds them up.
   - The cards' details come from Scryfall in big batches, one lookup per
     set of cards, and are kept for a while so reopening a binder is quick.
   - Card Kingdom's prices come from its own price list (about 8 MB, so it's
     only downloaded when Card Kingdom is the chosen store, and only once).
   - A price is for the copies you have: the foil price for a foil copy,
     times how many copies. A card the store has no price for counts as
     nothing in the total (and shows a dash).
   Gives back: each card's price by its pocket key, the total, which
   currency it's in, and whether prices are still loading.
   ===================================================================== */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettings } from '@/hooks/useSettings';
import { cardCount } from '@/lib/binderStorage';
import { copyPrice, currencyOf, loadCardKingdomPrices } from '@/lib/prices';
import { loadPrintings } from '@/lib/scryfall';
import type { CardEntry } from '@/components/binder/CardList';

export type BinderPrices = {
  // Each card's price for all its copies, by pocket key (null = no price)
  byKey: Map<string, number | null>;
  // Everything added up (null until the prices have loaded)
  total: number | null;
  currency: 'USD' | 'EUR';
  // Still waiting for the prices?
  loading: boolean;
  // Couldn't get the prices?
  failed: boolean;
};

// How long the looked-up card details are kept before asking again
const KEEP_MS = 60 * 60 * 1000;

export function useBinderPrices(entries: CardEntry[]): BinderPrices {
  const { priceStore } = useSettings();

  // The printings to look up: each set and number once, in a steady order
  // (so the same cards give the same lookup, and it's kept)
  const wanted = useMemo(() => {
    const seen = new Set<string>();
    for (const { card } of entries) seen.add(`${card.set.toLowerCase()}/${card.number}`);
    return [...seen].sort().map((id) => {
      const slash = id.indexOf('/');
      return { set: id.slice(0, slash), number: id.slice(slash + 1) };
    });
  }, [entries]);
  const signature = wanted.map((w) => `${w.set}/${w.number}`).join('|');

  // The cards' details (with their prices at TCGplayer and Cardmarket)
  const printings = useQuery({
    queryKey: ['binder-printings', signature],
    queryFn: () => loadPrintings(wanted),
    enabled: wanted.length > 0,
    staleTime: KEEP_MS,
  });

  // Card Kingdom's price list, only when it's the chosen store
  const cardKingdom = useQuery({
    queryKey: ['card-kingdom-prices'],
    queryFn: loadCardKingdomPrices,
    gcTime: Infinity,
    enabled: priceStore === 'cardkingdom' && wanted.length > 0,
  });

  const currency = currencyOf(priceStore);
  const loading = wanted.length > 0 && (printings.isLoading || (priceStore === 'cardkingdom' && cardKingdom.isLoading));
  const failed = printings.isError || (priceStore === 'cardkingdom' && cardKingdom.isError);

  return useMemo(() => {
    const byKey = new Map<string, number | null>();
    let total = 0;
    const ready = printings.data && (priceStore !== 'cardkingdom' || cardKingdom.data);
    if (ready) {
      for (const { key, card } of entries) {
        const print = printings.data!.get(`${card.set}/${card.number}`.toLowerCase());
        const each = print ? copyPrice(priceStore, print, card.foil === true, cardKingdom.data) : null;
        const line = each === null ? null : Math.round(each * cardCount(card) * 100) / 100;
        byKey.set(key, line);
        if (line !== null) total += line;
      }
    }
    return { byKey, total: ready ? Math.round(total * 100) / 100 : null, currency, loading, failed };
  }, [entries, printings.data, cardKingdom.data, priceStore, currency, loading, failed]);
}
