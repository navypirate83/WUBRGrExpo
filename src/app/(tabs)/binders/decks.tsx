/* =====================================================================
   DECKS (/binders/decks)
   The third page of The Shelf, after Binders and Lists. It isn't built
   yet: this is the place to build it, already wired in so that
   - on a phone its header has the same small Binders / Lists / Decks
     buttons as the other two pages (see ShelfSwitch.tsx and
     binders/_layout.tsx), and
   - on a wide screen the side menu lists Decks under Lists and
     highlights it here (see SideMenu.tsx).
   For now the page just says it is still being built.
   When the page is built, replace the "still being built" message with
   the decks themselves.
   ===================================================================== */

import StillBuilding from '@/components/StillBuilding';

// The page: just the "still being built" message for now
export default function DecksScreen() {
  return <StillBuilding title="Decks" message="This screen is still being built." />;
}
