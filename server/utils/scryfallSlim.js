/* =====================================================================
   TRIMMING A SCRYFALL CARD DOWN
   Scryfall sends about 100 pieces of information for each card (long
   rules text, every price, dozens of web links...). The app only uses a
   few of them. slimCard() keeps just those, with the same names Scryfall
   uses, so the app can treat a trimmed card exactly like a full one.
   Trimmed cards take roughly a quarter of the space, which matters in
   two places: the free database is small (512 MB), and the phone saves
   these cards to use offline.
   Images are never downloaded here: a card only carries the web
   ADDRESSES of its pictures, and the phone fetches them straight from
   Scryfall's picture server.
   ===================================================================== */

// Only these four sizes of picture are kept (the biggest "png" included
// because the app can show it)
function slimImages(images) {
  if (!images || typeof images !== 'object') return undefined;
  const kept = {};
  for (const size of ['small', 'normal', 'large', 'png']) {
    if (typeof images[size] === 'string') kept[size] = images[size];
  }
  return kept;
}

// One side of a two-sided card
function slimFace(face) {
  return {
    name: face.name,
    image_uris: slimImages(face.image_uris),
    mana_cost: face.mana_cost,
    type_line: face.type_line,
  };
}

// The prices, as the text Scryfall sends ("0.31") or null
function slimPrices(prices) {
  if (!prices || typeof prices !== 'object') return undefined;
  const kept = {};
  for (const name of ['usd', 'usd_foil', 'usd_etched', 'eur', 'eur_foil', 'eur_etched']) {
    kept[name] = typeof prices[name] === 'string' ? prices[name] : null;
  }
  return kept;
}

// The two store links the app uses
function slimPurchaseLinks(links) {
  if (!links || typeof links !== 'object') return undefined;
  const kept = {};
  if (typeof links.tcgplayer === 'string') kept.tcgplayer = links.tcgplayer;
  if (typeof links.cardmarket === 'string') kept.cardmarket = links.cardmarket;
  return kept;
}

// Takes a full card from Scryfall and returns the trimmed one.
// Parts Scryfall didn't send are left out (undefined parts vanish when
// the card is turned into JSON).
export function slimCard(card) {
  return {
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    lang: card.lang,
    set: card.set,
    set_name: card.set_name,
    collector_number: card.collector_number,
    rarity: card.rarity,
    mana_cost: card.mana_cost,
    type_line: card.type_line,
    released_at: card.released_at,
    artist: card.artist,
    scryfall_uri: card.scryfall_uri,
    prints_search_uri: card.prints_search_uri,
    rulings_uri: card.rulings_uri,
    image_status: card.image_status,
    image_uris: slimImages(card.image_uris),
    card_faces: Array.isArray(card.card_faces) ? card.card_faces.map(slimFace) : undefined,
    border_color: card.border_color,
    full_art: card.full_art,
    textless: card.textless,
    frame: card.frame,
    frame_effects: card.frame_effects,
    promo: card.promo,
    finishes: card.finishes,
    legalities: card.legalities,
    prices: slimPrices(card.prices),
    purchase_uris: slimPurchaseLinks(card.purchase_uris),
  };
}
