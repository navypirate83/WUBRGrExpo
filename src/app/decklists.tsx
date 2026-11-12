/* =====================================================================
   THE OLD DECKS ADDRESS (/decklists)
   Decks used to be a screen of its own here. It's now the third page of
   The Shelf (see app/(tabs)/binders/decks.tsx), so this just sends anyone
   using the old address (a bookmark or an old link) to the new one.
   ===================================================================== */

import { Redirect } from 'expo-router';

export default function OldDecksAddress() {
  return <Redirect href="/binders/decks" />;
}
