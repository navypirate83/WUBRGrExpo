# Deck formats research (for the Decks page)

Researched 2026-11-13 from Scryfall's legality list plus rules pages (mtg.wiki,
Wizards, oathbreakermtg.org, Draftsim, etc.). **This app is paper formats only.**
Brawl (all three), Alchemy, Historic, Timeless and Gladiator are removed and must
never appear (see `NOT_PAPER_FORMATS` in `src/lib/cards.ts`).

Scryfall's `legalities` keys (23): standard, future, historic, timeless, gladiator,
pioneer, modern, legacy, pauper, vintage, penny, commander, oathbreaker,
standardbrawl, brawl, competitivebrawl, alchemy, paupercommander, duel, oldschool,
premodern, predh, tlr.

Formats the app keeps (17): standard, future, pioneer, modern, legacy, vintage,
pauper, penny, premodern, oldschool, commander, duel, predh, paupercommander,
oathbreaker, tlr.

## Layout A: main deck + sideboard (no commander)

60+ card main deck, sideboard up to 15, up to 4 copies of a card (basic lands
excepted). Vintage and Old School also have a restricted list (1 copy).

| Format | What makes it different |
|---|---|
| standard | Recent sets only; old ones rotate out |
| future | Standard plus upcoming sets |
| pioneer | Return to Ravnica (2012) onward |
| modern | 8th Edition (2003) onward |
| legacy | Almost every card, ban list |
| vintage | Almost every card, ban list + restricted list |
| pauper | Only cards printed at common |
| penny | Only very cheap cards; list changes each season |
| premodern | Fourth Edition through Scourge |
| oldschool | 1993-94 cards only; rules vary by group (60 + 15 common), restricted + ban lists |

## Layout B: command-zone card(s) on top, singleton rest, color identity applies

Every card must fit inside the top card's color identity. One copy of each card
(basic lands excepted).

| Format | Top slot(s) | Rest of deck | Notes |
|---|---|---|---|
| commander | 1 legendary creature (or card that says it can be commander) | 99 | 40 life, 21 commander damage. Partner / Background / Doctor's companion allow a 2nd command card |
| duel | same as Commander | 99 | 1v1, own ban list, sources say 20 life |
| predh | same as Commander | 99 | Only cards before 2011 (up to New Phyrexia) |
| paupercommander | 1 uncommon creature (needn't be legendary) | 99 commons | Fan-run; life total / bans vary by group |
| oathbreaker | 1 planeswalker + 1 signature spell (instant or sorcery) | 58 (60 total) | Both top cards set color identity. Spell castable only while its walker is on the battlefield; returns to command zone. 20 life, own ban list. Partner version: 2 walkers + 2 spells + 56 cards |
| tlr (Tiny Leaders Reborn) | 1 commander | 49 (50 total) | Every card mana value 3 or less. Sideboard up to 10. Sources disagree on life (20 or 25) |

## Layout C (not used): 100-card singleton, no commander = Gladiator (Arena only, removed)

## Build notes

- Per-format settings: number of top slots, what each slot accepts, main-deck
  size, sideboard size, copy limit, color identity yes/no.
- Layout A can use Scryfall's per-card `legalities` to flag illegal cards.
- Layout B needs a "can this be the commander?" check from `type_line` +
  `color_identity`; Partner / Background / Companion need special handling.
- Ban / restricted lists change often: read them live from Scryfall legality data
  rather than copying them here.
- Unsure: Pauper Commander and TLR life totals (conflicting sources); Old School
  rules vary by group.

## Sources

mtg.wiki pages (Pauper Commander, Duel Commander, Premodern, Tiny Leaders,
Old School), magic.wizards.com/en/formats/oathbreaker, oathbreakermtg.org/rules,
draftsim.com/predh-mtg, Scryfall card `legalities` field.

## Decks section: search and add-card behavior (planned, not built)

Told by the user on 2026-11-13. No decks exist yet.

- **Decks page:** one search bar, fuzzy search over deck names and over the
  cards inside decks. No + button on this page.
- **Inside a deck:** a search bar over all cards, shown as a list like the
  Card Finder's name suggestions. Each row has a + that adds that card (the
  first printing that comes up). The user changes the printing later by opening
  the card in the deck.
- **Duplicate rule:** past the format's copy limit (1 in singleton formats, 4
  in formats that allow 4) show a pop-up warning with a way to add it anyway,
  since some cards allow any number. Basic lands, snow-covered basic lands and
  Wastes never trigger it.
- **Owned-only switch:** the add-card search inside a deck gets a switch to
  search only cards in the user's binders. Lists do not count (they are
  wishlists, not owned). Off searches all cards.
