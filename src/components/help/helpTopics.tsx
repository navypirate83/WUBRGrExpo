/* =====================================================================
   THE HELP TEXT
   All the instructions on the Help screen, as a list: one "topic" for
   each part of the app (The Shelf, Binder pages, MTG Card Finder and
   Settings), each with its sections. The Help screen draws the topic
   buttons, the list of sections and the instructions from this one
   list, so a section added here shows up everywhere it should.
   Each id (like "binder-moving") is how other screens open Help at that
   spot (/help?topic=binder-moving), and how a HelpLink jumps to it, so
   keep the ids the same when changing the words.
   The text is written with the small pieces in HelpText.tsx (P for a
   paragraph, Bullet and Step for lists, Strong for bold words, and so on).
   Words about keyboard keys are wrapped in OnComputer, so the phone app
   leaves them out.
   A WORD ABOUT SPACES: in this kind of file, a line break next to a
   <Strong> or other piece swallows the space there. So the lines below
   only ever break between two plain words.
   ===================================================================== */

import type { ReactNode } from 'react';
import { Bullet, Em, HelpLink, Key, OnComputer, P, Step, Strong } from './HelpText';

import { SITE_NAME } from '@/lib/site';
// One section of instructions: its id, its heading, and its text.
// "computerOnly" sections (the keyboard ones) are left out of Help in
// the phone app, where there are no shortcut keys.
export type HelpSection = {
  id: string;
  title: string;
  body: ReactNode;
  computerOnly?: boolean;
};

// One part of the app: its id, its name, a short summary, and its sections
export type HelpTopic = {
  id: string;
  title: string;
  lead: ReactNode;
  sections: HelpSection[];
};

// The website's address (the app also runs in any web browser)
const WEBSITE = SITE_NAME;

export const helpTopics: HelpTopic[] = [
  /* ===================== THE SHELF ===================== */
  {
    id: 'my-binders',
    title: 'The Shelf',
    lead: (
      <>
        The Shelf holds every binder you own, side by side: a closed binder for each (its
        name, cover symbol and color), with how many cards it has under it. As many fit
        across as the screen has room for, and more rows appear as you make more. Tap <Strong>The
        Shelf</Strong> (the row of books) at the bottom of the screen to get to it.
        The three small picture buttons in the header, beside the page's name, switch between your <Strong>Binders</Strong> (the open
        binder), your <Strong>Lists</Strong> (the spiral notebook) and your <Strong>Decks</Strong> (the
        Commander deck box, which isn't built yet); the faded one is the page you're on.
        (See <HelpLink to="my-binders-lists">Lists</HelpLink>.)
      </>
    ),
    sections: [
      {
        id: 'my-binders-start',
        title: 'Getting started',
        body: (
          <>
            <P>
              When you first open the app, you see the <Strong>Home</Strong> screen: a picture
              of an open binder full of cards, with these choices under it:
            </P>
            <Bullet>
              <Strong>Login</Strong> to your WUBRG'r account with your username (or email) and
              password. Your binders and lists are saved in your account and on this device, so you
              can open them on any phone or computer, and the app still works with no internet.
              On the login screen, <Strong>Forgot username/password?</Strong> emails you your
              username and a 6-digit code to set a new password.
            </Bullet>
            <Bullet>
              <Strong>Create account</Strong> (the link under Login): type your name, email, a
              password of at least 8 characters, and optionally a username (left empty, your
              email is your username). The binders and lists already on this device are
              saved to your new account.
            </Bullet>
            <Bullet>
              <Strong>Skip login, local use only</Strong> to start right away without an
              account. Your binders are saved on this device only. You can log in later
              (see <HelpLink to="settings-account">Your account</HelpLink>).
            </Bullet>
            <P>
              Either way, you then see your shelf of binders. The app remembers your choice:
              after that, <Strong>Home</Strong> shows a <Strong>Go to your binders</Strong> button
              instead of the sign-in buttons, and <Strong>The Shelf</Strong> (the row of books
              at the bottom of the screen) goes straight to your shelf.
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-new',
        title: 'Making a binder',
        body: (
          <>
            <Step n={1}>Tap <Strong>Add binder</Strong> at the top of The Shelf (or <Strong>Make your first binder</Strong> on an empty shelf). The <Strong>New binder</Strong> window opens.</Step>
            <Step n={2}>
              Type a <Strong>name</Strong>, up to 12 characters so it fits on the cover's
              label. A name like "Binder 3" is filled in for you.
            </Step>
            <Step n={3}>
              Pick a <Strong>cover symbol</Strong> from one of two lists. Tap <Strong>Mana Symbols</Strong> for
              none, one of the five colors, colorless, planeswalker, or one of the two-color
              symbols. Tap <Strong>Set Symbols</Strong> for the symbol of any Magic set: type in the
              search box to find one by set name or code. Sets that share the same symbol (Secret
              Lair and the Pro Tour promos, say) are listed once, with how many sets use it. Picking
              from one list replaces what was picked from the other. Alchemy and Arena sets aren't
              in the list.
            </Step>
            <Step n={4}>
              Pick a <Strong>cover color</Strong>. Choose <Strong>Custom</Strong> for more colors,
              or type any color code (like #3a7bd5).
            </Step>
            <Step n={5}>Tap <Strong>Create binder</Strong>.</Step>
            <P>
              New binders have 10 pages: 160 cards with the usual 16 pockets a page (4 across,
              4 down), or as many as your <HelpLink to="settings-layout">page layout</HelpLink> holds.
              There's no limit on how many binders you can make.
            </P>
            <P>
              To bring back a binder you saved as a file, or make one from a ManaBox card list,
              use <Strong>Upload .CSV</Strong> in the same window (see <HelpLink to="my-binders-backup">Binder files</HelpLink>).
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-open',
        title: 'Opening and arranging',
        body: (
          <>
            <Bullet><Strong>Open a binder</Strong>: tap (or click) it. The back arrow at the top left
              brings you back to the shelf (or a swipe in from the left edge on an iPhone).</Bullet>
            <Bullet>
              <Strong>Its options</Strong>: on a phone or tablet, rest your finger on a binder until it
              lifts (with a small buzz). Three boxes appear along the bottom: <Strong>Edit</Strong>,{' '}
              <Strong>Copy</Strong> (a duplicate with the same cards, named like "Black (1)", at the end
              of the shelf) and a red <Strong>Delete</Strong>. Slide the binder onto one and let go. Let
              go anywhere else and it just drops into place. With a mouse, hold the button still for
              half a second or <Strong>right-click</Strong> the binder to get the same three choices.
            </Bullet>
            <Bullet>
              <Strong>Pick several at once</Strong> (on a computer): hold <Strong>Ctrl</Strong> (or{' '}
              <Strong>Cmd</Strong>) and click each binder you want. Picked binders get a frame and a
              tick. Let go of Ctrl and a window asks whether to <Strong>Copy</Strong> or{' '}
              <Strong>Delete</Strong> them. <Strong>Esc</Strong> drops the picks. With only the
              keyboard: the <Key>arrow keys</Key> move an outline from binder to binder,{' '}
              <Key>Space</Key> picks or un-picks the one it is on, and <Key>Enter</Key> asks Copy or
              Delete.
            </Bullet>
            <Bullet>
              <Strong>Change the order</Strong>: drag a binder to a new spot. With a finger, rest it
              on the binder until it lifts, then slide (sliding straight away scrolls the shelf). With
              a mouse, press the button and move. The other binders shift along to make room. When
              signed in, the order is saved to Google Drive, so it's the same on every device.
            </Bullet>
            <Bullet>
              <Strong>Load again</Strong>: pull the shelf down and let go. When signed in, your binders
              are fetched fresh from Google Drive (handy after changing them on another device).
            </Bullet>
          </>
        ),
      },
      {
        id: 'my-binders-lists',
        title: 'Lists',
        body: (
          <>
            <P>
              Lists keep cards without pockets or pages: a want list, cards to trade, upgrades for
              a deck. Tap the <Strong>notebook</Strong> button in the header of The Shelf to see them.
              Each list shows its name and how many cards it has.
            </P>
            <Bullet><Strong>Make a list</Strong>: tap <Strong>Add list</Strong>, type its name, then tap <Strong>Save</Strong>.</Bullet>
            <Bullet><Strong>Open it</Strong>: tap it.</Bullet>
            <Bullet>
              <Strong>Rename or delete it</Strong>: hold it for a moment, then tap <Strong>Rename</Strong> (type
              the new name and tap <Strong>Save</Strong>) or <Strong>Delete</Strong> (it asks first).
            </Bullet>
            <Bullet><Strong>Load again</Strong>: pull the lists down and let go.</Bullet>
            <P>
              Inside a list, the cards are shown the way a binder shows its cards, as a <Strong>List</Strong> (a
              small picture, the name, the set and number, a <Strong>− 3 +</Strong> bar for how many copies you
              want, and the price) or a <Strong>Grid</Strong> of card pictures. The small list and grid icon buttons under the search
              box switch between them, and the app remembers your choice (one for a phone-sized window, one for a
              wide screen, saved with your account). A list has no pockets, so there's no Binder view. The sort button
              at the right works like a binder's (tap the sort in use again to reverse it), foil cards have the rainbow
              border, a line above the cards shows how many cards and what they're worth at the store chosen
              under <Strong>Price store</Strong> in Settings, and on the website the grid can be zoomed in and out.
              The search box narrows the list as you type to the cards whose name matches (small typos are
              fine) or whose type contains what you typed, and a line says how many match.
            </P>
            <P>
              Tap the red <Strong>+</Strong> to find a card in the Card Finder, then tap its <Strong>+</Strong> to put it
              in the list. Tap a card for its window: a big picture of it (tap the picture to open the card in the
              Card Finder), what the card does (its rules text, without the flavor text), how many copies
              (<Strong>−</Strong> and <Strong>+</Strong>; <Strong>−</Strong> on
              the last copy asks whether to delete it), <Strong>Move to a
              binder</Strong> (pick a binder: the card goes into its first empty pocket and leaves the
              list) and <Strong>Delete from list</Strong> (it asks first).
            </P>
            <P>
              Lists are saved like binders: to Google Drive when you're signed in (as .csv files, in
              a "Lists" folder inside "MTG Card Binder"), or on this device when you use the app
              locally. The check mark beside the list's name is green when it's saved and red while
              it isn't (tap it to see why). The <Strong>down arrow</Strong> button, beside the List and
              Grid buttons under the search box, downloads the list as a .CSV file.
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-edit',
        title: 'Changing a binder',
        body: (
          <>
            <P>
              Rest your finger on the binder until it lifts, then slide it onto <Strong>Edit</Strong> at
              the bottom of the screen (with a mouse: hold it still, or right-click, then choose
              <Strong>Edit</Strong>). <Strong>Binder properties</Strong> opens, where you can change:
            </P>
            <Bullet>its <Strong>name</Strong>,</Bullet>
            <Bullet>
              how many <Strong>pages</Strong> it has (with the <Strong>−</Strong> and <Strong>+</Strong> buttons,
              or type a number). It can't be made smaller than the pages its cards need; cards on
              pages that go away are moved into empty pockets on the pages that stay,
            </Bullet>
            <Bullet>its <Strong>cover symbol</Strong> (a mana symbol or a set symbol) and <Strong>cover color</Strong>.</Bullet>
            <P>Tap <Strong>Save</Strong> to keep the changes, or <Strong>Cancel</Strong> to leave it as it was.</P>
          </>
        ),
      },
      {
        id: 'my-binders-delete',
        title: 'Deleting a binder',
        body: (
          <>
            <P>
              Rest your finger on the binder on The Shelf until it lifts, then slide it onto the red
              <Strong>Delete</Strong> at the bottom of the screen (with a mouse: right-click it, then
              choose <Strong>Delete</Strong>).
              You'll be asked if you're sure (with how many cards are in it).
              Tap <Strong>Yes, delete</Strong> to delete it, or <Strong>No</Strong> to keep it.
              With no binders left, The Shelf says it's empty and offers to make one.
            </P>
            <P>
              When signed in, a deleted binder goes to your Google Drive trash, where you can
              restore it for 30 days. When using the app locally, it's gone for good.
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-backup',
        title: 'Binder files',
        body: (
          <>
            <P>
              Each binder is saved as a <Strong>.CSV file</Strong>: a simple table of its cards
              that spreadsheet programs (like Excel or Google Sheets) can open. It uses the same
              columns as a <Strong>ManaBox</Strong> collection export (except ManaBox ID,
              Misprint, Altered and Signed), so ManaBox can import it. Each line is one card,
              with its name, set, collector number, foil, how many copies, language and the date
              it was added. After those come:
            </P>
            <Bullet><Strong>Page</Strong> and <Strong>Pocket</Strong>: where the card is in the binder.</Bullet>
            <Bullet><Strong>Side</Strong>: which side of a two-sided card faces out.</Bullet>
            <Bullet>
              <Strong>Binder</Strong>, <Strong>Cover symbol</Strong>, <Strong>Cover color</Strong> and <Strong>Pages</Strong>:
              the binder's own name, cover and size (the same on every line).
            </Bullet>
            <Bullet>
              <Strong>Page layout</Strong>: the pockets across and down a page (like "4x4") that
              the Page and Pocket numbers count in. A file saved with one layout opens correctly
              with another: its cards stay in the same order.
            </Bullet>
            <P>You can also save a binder to your phone or computer, to keep as a backup or share with a friend:</P>
            <Bullet>
              <Strong>Download</Strong>: open the binder, then tap the
              small <Strong>down arrow</Strong> button beside the List, Grid and Binder buttons<OnComputer> (or
              press <Key>D</Key> on a computer)</OnComputer>. On a phone, your share menu opens, so you can
              save the file to Files, email it, or send it to another app. On a computer, it's
              downloaded like any other file.
            </Bullet>
            <Bullet>
              <Strong>Upload</Strong>: tap <Strong>Add binder</Strong> on The Shelf, then <Strong>Upload .CSV</Strong> in
              the New binder window, and pick a file. It's added to the end of your shelf as a
              new binder, with every card in the pocket it was saved in. If the file has more
              cards than the binder's pages hold, pages are added until they all fit. If you
              already have a binder with that name, the new one is called "Name (1)", then
              "Name (2)", and so on. (Names can be up to 12 characters, so a long name is
              shortened to make room for the number, like "Planeswa (1)". You can rename it in
              Binder properties.)
            </Bullet>
            <P>
              <Strong>From ManaBox</Strong>: export a collection or binder as a .CSV in ManaBox,
              then upload it here. Its cards fill the pockets in the order they're listed (10
              pages to start, with more added if it needs them), and the binder is named after
              the file. Details WUBRG'r doesn't show (like condition or purchase price) are
              kept, so they're still there when you download it again. Older
              WUBRG'r <Strong>.JSON</Strong> binder files can be uploaded too.
            </P>
            <P>
              Binders saved before were .JSON files. The first time you open The Shelf, each one
              is turned into a .CSV file. A backup copy of the old .JSON file is kept in the same
              Google Drive folder.
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-search',
        title: 'Searching your binders',
        body: (
          <>
            <P>
              The <Strong>Search your binders</Strong> bar sits at the top of The Shelf and
              above every binder's pages. It only looks at the cards in your binders. Start
              typing a card's name: part of it is enough, and small typos are fine ("demnic"
              still finds Demonic Tutor).
            </P>
            <Bullet>
              <Strong>Inside a binder</Strong>, the binder narrows to the matching cards as you type
              (small typos are fine). In the <Strong>List</Strong> and <Strong>Grid</Strong> views the cards that
              don't match disappear, and a line says how many match ("2 of 15 cards match"). In
              the <Strong>Binder</Strong> view the matching cards are shown on their own, and
              you <Strong>tap the one you want</Strong> to jump to its pocket: the binder turns to its page, the
              search empties, and the pocket glows. Clear the box to bring everything back.
            </Bullet>
            <Bullet>
              A list drops down under the bar only when what you typed isn't an exact card name, with the
              closest names, each with the binder and page it's in (and "×3" if a pocket holds
              several copies). Searching the whole <Strong>Shelf</Strong> always shows the list, since the cards
              are in other binders. On The Shelf's own search bar, the list always shows.
            </Bullet>
            <Bullet>
              Tap (or click) one.<OnComputer> On a computer you can also use the <Strong>up and down arrow
              keys</Strong> and press <Key>Enter</Key>.</OnComputer> <Key>Enter</Key> (or the magnifying glass)
              on its own goes to the top match.
            </Bullet>
            <Bullet>
              The binder opens at that page, with the card's pocket <Strong>outlined and
              glowing</Strong>. The glow goes when you tap the binder or press a key.
            </Bullet>
            <Bullet>
              Inside a binder, the switch beside the search bar says what's searched: <Strong>Current</Strong> (just
              that binder, to start) or, switched off, <Strong>Shelf</Strong> (every binder).
            </Bullet>
            <OnComputer><Bullet>On a computer, <Key>Escape</Key> closes the list (press it again to empty the box).</Bullet></OnComputer>
          </>
        ),
      },
      {
        id: 'my-binders-links',
        title: 'Getting around',
        body: (
          <>
            <P>The four <Strong>icons</Strong> along the bottom of the screen take you to the main parts of the app, from left to right:</P>
            <Bullet>
              <Strong>Home</Strong> (the house): the welcome screen. When you're signed in (or using the app
              locally), it has no sign-in buttons, just a <Strong>Go to your binders</Strong> button.
              It also has buttons for <Strong>Lists</Strong> (your card lists)
              and <Strong>Decks</Strong> (your decklists, still being built).
            </Bullet>
            <Bullet>
              <Strong>The Shelf</Strong> (the row of books): your binders, lists and decks. It takes you back to
              wherever you were in the shelf, like the binder you had open (on the same page), even after a trip
              to Settings or the Card Finder. (On a phone, if you're already inside a binder or list, tapping it takes you
              up to the main page instead: the shelf of binders, or the lists page.) The <Strong>Binders</Strong>, <Strong>Lists</Strong> and <Strong>Decks</Strong> buttons
              in the header do the same for their own part: after visiting Lists, the Binders button opens
              the binder you were in, not the shelf.
            </Bullet>
            <Bullet><Strong>Card Finder</Strong> (the magnifying glass): the MTG Card Finder, to look up any card.</Bullet>
            <Bullet>
              <Strong>Settings</Strong> (the gear): the theme (light or dark) and more
              (see <HelpLink to="settings">Settings</HelpLink>).
            </Bullet>
            <P>
              Each tab remembers where you were, so switching back finds it just as you left it.
            </P>
            <P>
              <Strong>On a tablet, an opened foldable phone, or the website in a wide window</Strong>, the
              tabs move from the bottom to a <Strong>menu down the left side</Strong>. It has Home, a{' '}
              <Strong>The Shelf</Strong> heading (tap it to go back to where you were in the shelf, or, if you're inside a binder or list, up to its main page) with <Strong>Binders</Strong>, <Strong>Lists</Strong> and <Strong>Decks</Strong> under
              it (each opens the last place you were in that part; the one for the part you're inside goes up to its main page), Card Finder, Settings and Help. At the bottom is your account: tap it for Account
              settings, Sync now and <Strong>Log out</Strong> (which asks "Are you sure?" first). Logged
              out, it has Log in and Create account buttons. On a narrower window, or a phone held
              sideways, the menu is just the icons on its own. On a wide window, the small round arrow button at the top of the menu collapses
              the menu to just the icons (and expands it again); the app remembers your choice. With the menu
              showing, the header leaves out its own small Binders, Lists and Decks buttons (and its Help button), since the menu has them. A normal
              phone keeps the tabs along the bottom.
            </P>
            <P>
              The round <Strong>?</Strong> at the top right of a screen opens these instructions,
              at the part for the screen you were on.
            </P>
            <P>
              Every screen has a <Strong>back arrow</Strong> at the top left. It works like a
              browser's Back button: it takes you to the page you were just on, and tap it again to
              go back further, one page at a time, all the way to the page you first opened the app
              on. It goes back through every kind of move: the tabs, the side menu, the Binders,
              Lists and Decks buttons, an open binder, Help and signing in. On that first page there
              is nowhere to go back to, so the arrow is grayed out and does nothing. On Android, the
              phone's own Back button or gesture also goes back; on an iPhone, you can also swipe
              in from the left edge of the screen.
            </P>
            <OnComputer>
              <P>
                Using a keyboard on a computer? Press <Key>?</Key> on a screen to see a list of its
                keyboard shortcuts. On this Help screen, <Key>Tab</Key> moves through the topics and
                links, and <Key>Enter</Key> opens one.
              </P>
            </OnComputer>
          </>
        ),
      },
      {
        id: 'my-binders-install',
        title: 'The app and the website',
        body: (
          <>
            <P>
              WUBRG'r is an app for iPhone and Android phones and tablets, with the open-binder
              icon on your home screen. It's also a website, for any computer or tablet with a
              web browser: <Strong>{WEBSITE}</Strong>. Both work the same way.
            </P>
            <P>
              To keep the website handy, bookmark it. On a phone or tablet's browser, you can
              also add it to your home screen: in Safari, tap the <Strong>Share</Strong> button
              (a square with an arrow), then <Strong>Add to Home Screen</Strong>; in Chrome,
              open the menu (the three dots) and choose <Strong>Add to Home screen</Strong>.
            </P>
            <P>
              With no internet, your binders on this device still open and work as usual
              (changes are saved to Google Drive when you're back online). Searching for cards
              needs the internet, except that when you're logged in, the card names and any card
              you've looked at before are saved on this device and still work without it. On the
              phone app, card pictures are saved too once you've seen them (Settings →
              Card pictures can save them all ahead of time); pictures not saved yet show the back
              of a Magic card.
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-keyboard',
        title: 'Using the keyboard (computers)',
        computerOnly: true,
        body: (
          <>
            <P>On a computer, these keys work anywhere on The Shelf (not while typing in a box):</P>
            <Bullet><Key>Arrow keys</Key>: move an outline from binder to binder.</Bullet>
            <Bullet><Key>Space</Key>: pick or un-pick the binder the outline is on. Picked binders get a frame and a tick.</Bullet>
            <Bullet><Key>Shift</Key> + <Key>Arrow keys</Key>: pick the binders you move over.</Bullet>
            <Bullet><Key>Ctrl</Key> + <Key>A</Key> (<Key>Cmd</Key> + <Key>A</Key> on a Mac): pick every binder.</Bullet>
            <Bullet><Key>Enter</Key>: open the binder the outline is on. With some picked, it asks whether to Copy or Delete them.</Bullet>
            <Bullet><Key>C</Key>: copy the picked binders (or the one the outline is on).</Bullet>
            <Bullet><Key>Delete</Key>: delete the picked binders (or the one the outline is on), after asking "Are you sure?".</Bullet>
            <Bullet><Key>Esc</Key>: drop the picks.</Bullet>
            <Bullet><Key>N</Key>: make a new binder (the window with the cover choices).</Bullet>
            <Bullet><Key>?</Key>: show these keys (or click <Strong>Keyboard shortcuts</Strong> under Add binder).</Bullet>
            <P>
              Every binder and button can also be reached with <Key>Tab</Key> and opened
              with <Key>Enter</Key>. A screen reader also offers each binder's <Strong>Properties</Strong> and <Strong>Delete</Strong> as
              actions, and says where it is on the shelf (like "Binder 2 of 5").
            </P>
          </>
        ),
      },
      {
        id: 'my-binders-account',
        title: 'Signing in and out',
        body: (
          <>
            <P>
              Signing in and out is in <Strong>Settings</Strong>, under <Strong>Account</Strong> (see <HelpLink to="settings-account">Your account</HelpLink>).
            </P>
            <Bullet>
              When you're signed in, it shows your Google account and a <Strong>Sign out</Strong> button.
              Signing out sends any waiting changes to Google Drive, then disconnects Google.
              Your binders and lists stay on this device: only <Strong>Reset device memory</Strong> removes them.
            </Bullet>
            <Bullet>
              When using the app locally, or after signing out, there's a <Strong>Sign in with Google</Strong> button
              instead. Signing in compares this device with your Google Drive and asks which way to
              sync if they differ. (On phones, this is coming in the full app build; it works on the
              website now.)
            </Bullet>
          </>
        ),
      },
    ],
  },

  /* ===================== BINDER PAGES ===================== */
  {
    id: 'binder',
    title: 'Binder pages',
    lead: (
      <>
        A binder opens as its pages of pockets (the <Strong>Binder</Strong> view, below). The
        three small picture buttons under the search bar switch between <Strong>Binder</Strong> (the open
        binder drawing), <Strong>List</Strong> (the list icon: a
        small picture, the name, the set and number, how many copies you have and what they're
        worth) and <Strong>Grid</Strong> (the grid icon: card pictures side by side). The app remembers your choice
        for the next binder you open, one for a phone-sized window and one for a wide screen, and
        saves it with your account so it follows you to your other devices.
        In the list and grid, the button at the right (it shows the sort in use, like <Strong>A–Z</Strong>) drops
        down a menu: <Strong>Name</Strong> (A to Z), <Strong>Newest added</Strong>, <Strong>Price</Strong> (the
        most valuable first), <Strong>Color</Strong> (White, Blue, Black, Red, Green, then <Strong>Gold</Strong> for
        every card of two or more colors, then colorless), <Strong>Set</Strong> (the oldest set first), <Strong>Type</Strong> (Creatures, Enchantments,
        Artifacts, Sorceries, Instants, Battles, Planeswalkers, Lands, then anything else; anything that is a
        Land counts as a Land, even an Artifact Land), <Strong>Rarity</Strong> (Mythic,
        Rare, Uncommon, Common, Special) and <Strong>Mana value</Strong> (the cheapest first). Tap the sort already
        in use again to <Strong>reverse it</Strong>: Z to A, oldest added first, cheapest first, newest set first, most
        common first, or highest mana value first (<Strong>Color</Strong> and <Strong>Type</Strong> have no reverse). Cards that tie
        are in name order, and a card with nothing to go by (like no price) is always last.
        Every card is saved with the details sorting needs (its colors, type, rarity, mana value and
        set's release date), in the binder's .CSV and .JSON files too, so the sorts don't wait on the
        internet; cards made before that get them filled in the first time you open their binder. Sorting only changes how the list and grid are shown: it never
        moves a card to another pocket. A foil card has a rainbow border in every view. Tap a card in the list or grid for its menu: copies,
        open it in the Card Finder, move it or remove it.
        In the list, each card's row has its name, then its casting cost (in Magic's own mana symbols),
        its set's symbol, its set code and number (with a <Strong>*</Strong> for a foil or <Strong>**</Strong> for
        an etched foil), and its type line. In the list and the grid, each card has a <Strong>− 3 +</Strong> bar (in the grid it's along the card's
        bottom, like a pocket in the Binder view): tap <Strong>+</Strong> or <Strong>−</Strong> to change how many
        copies you own (<Strong>−</Strong> on the last copy asks whether to remove the card). On the website, the <Strong>−</Strong> and <Strong>+</Strong> buttons beside
        Sort zoom the card pictures out and in; the app remembers your zoom on that device.
        <OnComputer>On a computer you can also drag a card's picture (or its link) from Scryfall or EDHREC in another browser
        window and let go anywhere over the cards in the list or grid: the card is added, in the binder's next
        empty pocket, or as one more copy if you already have that exact printing. It appears wherever the sort in use puts it,
        and the view scrolls to it and highlights it for a moment. In a card list it's added the same way, at the end of the list.</OnComputer>
        To add a card from the list or grid, tap the red <Strong>+</Strong> in the corner: it opens the Card
        Finder, and the card goes into the binder's next empty pocket (if every pocket is full, a page is
        added at the end first).
        In the <Strong>Binder</Strong> view, <Strong>Clean-up</Strong> (at the right, under the search bar) asks, then
        moves every card forward to fill the empty pockets, keeping their order. It's faded when there are
        no empty pockets in the way.
        In every view, a line under the buttons shows how many cards the binder holds, how many different
        ones, and what they're all worth at the store chosen under <Strong>Price store</Strong> in Settings.
        The <Strong>Binder</Strong> view shows its pages, like a real binder lying open: two pages side by
        side on a tablet or computer, one page at a time on a phone. Each page has 16
        pockets, four across and four down, unless you've chosen another page layout
        in <HelpLink to="settings-layout">Settings</HelpLink>. The binder's name is at the top
        of the screen, with a check mark beside it: green when everything is saved, red when
        it isn't yet. The pages and pockets match your light or dark theme.
      </>
    ),
    sections: [
      {
        id: 'binder-pages',
        title: 'Turning pages',
        body: (
          <>
            <Bullet>
              Swipe <Strong>left</Strong> to go to the next page and <Strong>right</Strong> to
              go back. The page swings over like a real page turning. (With a mouse, use the
              buttons below instead: dragging with a mouse moves cards.)
            </Bullet>
            <Bullet>
              Or tap (or click) the small <Strong>‹</Strong> or <Strong>›</Strong> buttons under the binder. The
              page number between them shows where you are. <Strong>Tap the page number</Strong> to
              type a page and go straight to it.
            </Bullet>
            <OnComputer><Bullet>On a computer, the <Key>←</Key> <Key>→</Key> arrow keys and <Key>Page Up</Key> / <Key>Page Down</Key> turn pages too.</Bullet></OnComputer>
            <Bullet>
              In the phone app, a long page (like 3 across × 6 down) can be taller than the
              screen: the cards stay as wide as the screen, and you scroll up and down to see
              the rest. A new page starts at its top. On the website, the whole page always
              fits on the screen.
            </Bullet>
          </>
        ),
      },
      {
        id: 'binder-finding',
        title: 'Finding a card',
        body: (
          <>
            <P>
              The <Strong>Search your binders</Strong> bar above the pages finds any card you
              own. Type part of its name and pick it from the list. The right binder opens at the
              right page, with the card's pocket <Strong>outlined and glowing</Strong>.
            </P>
            <P>
              It searches this binder (<Strong>Current</Strong>, under the switch beside the search
              bar). Tap the switch to search every binder instead (<Strong>Shelf</Strong>). (More in <HelpLink to="my-binders-search">Searching your binders</HelpLink>.)
            </P>
          </>
        ),
      },
      {
        id: 'binder-adding',
        title: 'Adding cards',
        body: (
          <>
            <Step n={1}>Tap the white <Strong>+</Strong> in an empty pocket. This opens the MTG Card Finder.</Step>
            <Step n={2}>
              Search for the card and pick the exact set, version and language you own
              (see <HelpLink to="finder-search">MTG Card Finder</HelpLink>).
            </Step>
            <Step n={3}>
              Tap the round <Strong>+</Strong> button beside the card. It goes into the pocket you
              tapped, and you're taken back to that page of your binder.
            </Step>
            <P>
              <Strong>On a computer, you can also drag one in from Scryfall or EDHREC.</Strong> With
              scryfall.com or edhrec.com open in another browser window beside the binder, drag a
              card's picture (or its link) onto an <Strong>empty pocket</Strong>. The pocket gets an
              orange outline while you're over it; let go, and that exact card (printing, language
              and side) is added. Pockets that already hold a card don't accept drops.
            </P>
            <P>
              To <Strong>look at a card</Strong> already in the binder, tap it: its menu opens, the same one
              as in the List and Grid views. <Strong>Tap the card's picture</Strong> in that menu to open it in the
              Card Finder; there, picking a different printing and pressing <Strong>+</Strong> replaces the card in that pocket.
            </P>
            <P>
              Cards added as a foil or an etched foil have a <Strong>rainbow border</Strong>,
              so you can tell them apart at a glance. Tapping the picture in its menu opens it in the Card Finder
              with Foil (or Etched) already chosen.
            </P>
          </>
        ),
      },
      {
        id: 'binder-copies',
        title: 'How many copies',
        body: (
          <>
            <P>
              Along the bottom of each card is a small <Strong>− 1 +</Strong> bar showing how
              many copies of that card you own.
            </P>
            <Bullet><Strong>+</Strong> adds a copy (up to 99).</Bullet>
            <Bullet>
              <Strong>−</Strong> takes a copy away. If it's the last copy, you're
              asked <Strong>Remove card?</Strong> first. <Strong>Yes, remove</Strong> takes the card
              out of the pocket; <Strong>No</Strong> keeps it.
            </Bullet>
          </>
        ),
      },
      {
        id: 'binder-dragging',
        title: 'Moving cards around',
        body: (
          <>
            <Step n={1}>
              Rest your finger on a card for a moment, then slide it. The card lifts and follows
              your finger (most phones give a small buzz). With a mouse, just press the button on
              the card and move: it follows the mouse for as long as the button is held down.
            </Step>
            <Step n={2}>
              Without letting go, slide it where you want it. A quick tap still opens the card, and
              a quick swipe (moving straight away) still turns the page.
            </Step>
            <Bullet>Let go on an <Strong>empty pocket</Strong> to move it there.</Bullet>
            <Bullet>Let go on a pocket that <Strong>has a card</Strong>, and the two cards swap places.</Bullet>
            <Bullet>
              Hold it at the <Strong>left or right edge</Strong> of the binder, and the page turns,
              so you can move it to another page.
            </Bullet>
            <Bullet>
              In the phone app, on a page taller than the screen, hold it near the <Strong>top or bottom</Strong> of
              the binder, and the page scrolls that way.
            </Bullet>
            <Bullet>Let go anywhere else to put it back.</Bullet>
            <P>
              <Strong>Tapping a card</Strong> opens its menu: a big
              picture of the card (tap the picture to open the card in the Card Finder), what the card does (its rules
              text, without the flavor text), its copies (<Strong>−</Strong> and <Strong>+</Strong>),
              and <Strong>Move to another binder</Strong> and <Strong>Remove from this binder</Strong>.
            </P>
          </>
        ),
      },
      {
        id: 'binder-removing',
        title: 'Removing cards',
        body: (
          <>
            <P>There are two ways to take a card out of a binder:</P>
            <Bullet>
              Tap the card to open its menu, then tap <Strong>Remove from
              this binder</Strong> (it asks first).
            </Bullet>
            <Bullet>
              Or press <Strong>−</Strong> on its copies bar until the last copy, then
              answer <Strong>Yes, remove</Strong>.
            </Bullet>
          </>
        ),
      },
      {
        id: 'binder-moving',
        title: 'Moving to another binder',
        body: (
          <>
            <Step n={1}>
              Tap the card to open its menu, then
              tap <Strong>Move to another binder</Strong>.
              A list of your other binders pops up from the bottom of the screen, with each
              one's card count.
            </Step>
            <Step n={2}>
              If you own more than one copy, set <Strong>How many to move</Strong> at the top of the
              list with <Strong>−</Strong> and <Strong>+</Strong>. The rest stay in this binder.
            </Step>
            <Step n={3}>
              Tap one of your other binders. The card goes into its first empty pocket, or, if
              that binder already has the same printing (and both are foil, or both aren't), it's
              added to that card's copies. Full binders are greyed out.
            </Step>
            <Step n={4}>
              Or, to start a new binder with the card in it, tap <Strong>New binder</Strong> at the
              end of the list, then pick its name, symbol and cover and tap <Strong>Create binder</Strong>.
            </Step>
            <P>Tap the <Strong>×</Strong> or the dimmed area above the list to leave the card where it is.</P>
          </>
        ),
      },
      {
        id: 'binder-saving',
        title: 'Saving and backups',
        body: (
          <>
            <P>
              Every change saves by itself. The check mark beside the binder's name shows how
              it's going: <Strong>green</Strong> when everything is saved (to Google Drive when signed
              in, or on this device when using the app locally), <Strong>red</Strong> while a change
              is still being saved or couldn't be. Tap the check mark to see which. If your Google
              sign-in has run out, tapping it offers <Strong>Connect Drive</Strong> to sign in again
              and finish saving. Your changes stay safe on this device in the meantime.
            </P>
            <P>
              No internet? You can keep working: the check mark stays red, your changes are kept
              on this device, and they're saved to Google Drive as soon as you're back online. Card
              pictures that can't be downloaded show the back of a Magic card instead.
            </P>
            <P>
              To keep your own copy of a binder as a .CSV file, tap the <Strong>down
              arrow</Strong> at the top right of the screen<OnComputer>, or
              press <Key>D</Key> on a computer</OnComputer> (see <HelpLink to="my-binders-backup">Binder files</HelpLink>).
            </P>
          </>
        ),
      },
      {
        id: 'binder-reminders',
        title: 'Reminders (phones)',
        body: (
          <>
            <P>
              On a phone, the <Strong>bell</Strong> beside the List, Grid and Binder buttons sets a reminder: a
              notification later on, as a nudge to come back and sort new cards into this binder.
              Choose <Strong>In 10 seconds</Strong> (to try it out), <Strong>In 1 hour</Strong> or <Strong>Tomorrow</Strong>.
              Your phone gives a small buzz when it's set.
            </P>
            <P>
              The first time, your phone asks whether WUBRG'r may send you notifications:
              tap <Strong>Allow</Strong>. If you said no, the app tells you to turn them on in your
              phone's own Settings app. Reminders arrive even if the app is closed.
            </P>
            <P>Reminders are phone notifications, so they aren't available on the website.</P>
          </>
        ),
      },
      {
        id: 'binder-keyboard',
        title: 'Using the keyboard (computers)',
        computerOnly: true,
        body: (
          <>
            <P>On a computer, these keys work anywhere in a binder (not while typing in the search bar):</P>
            <Bullet><Key>←</Key> <Key>→</Key> or <Key>Page Up</Key> / <Key>Page Down</Key>: turn the page back or forward.</Bullet>
            <Bullet><Key>D</Key>: download this binder as a .CSV file.</Bullet>
            <Bullet><Key>?</Key>: show these keys (or click the <Strong>keypad</Strong> button at the top right).</Bullet>
            <P>
              Every button, pocket and card can also be reached with <Key>Tab</Key> and pressed
              with <Key>Enter</Key>. If you use a screen reader, page turns and changes are read out as you go.
            </P>
          </>
        ),
      },
    ],
  },

  /* ===================== MTG CARD FINDER ===================== */
  {
    id: 'finder',
    title: 'MTG Card Finder',
    lead: (
      <>
        The MTG Card Finder (the <Strong>Card Finder</Strong> tab) looks up any Magic card
        (using Scryfall's card list), shows its picture and details, and adds it to your
        binders. You can use it without signing in; adding to a binder needs you to be signed
        in or using the app locally. When you're logged in, card information comes through the
        WUBRG'r server and is saved on your device, so cards you've already looked at open
        quickly and still work with no internet.
      </>
    ),
    sections: [
      {
        id: 'finder-search',
        title: 'Searching for a card',
        body: (
          <>
            <Step n={1}>Start typing a card's name in the search box at the top.</Step>
            <Step n={2}>
              A list of matching names drops down. Tap (or click) one.<OnComputer> On a computer you can also
              use the <Strong>up and down arrow keys</Strong> and press <Key>Enter</Key>.</OnComputer>
            </Step>
            <Step n={3}>The card's picture appears, with its name, set and artist under it.</Step>
            <P>
              To start again, tap the <Strong>×</Strong> at the right end of the search box. It
              empties the box, ready for a new name.
            </P>
            <P>
              Looking for a card you already own? Use <Strong>Search your binders</Strong> on The
              Shelf instead (see <HelpLink to="my-binders-search">Searching your binders</HelpLink>).
            </P>
            <P>
              Cards with two sides have a <Strong>Flip card ↻</Strong> button under the picture to
              see the other side.
            </P>
          </>
        ),
      },
      {
        id: 'finder-printing',
        title: 'Set, version and language',
        body: (
          <>
            <P>
              Most cards were printed many times. Use these to pick the exact one you own. The{' '}
              <Strong>Set</Strong> and <Strong>Language</Strong> boxes each drop a scrolling list down right under
              them (or above, if there's no room below), with a check mark on your current choice. Tap a
              choice to pick it, or tap anywhere else to close the list.
            </P>
            <Bullet>
              <Strong>Set</Strong>: every set the card was printed in, with each set's symbol. A card can be in
              hundreds of sets, so there's a <Strong>Type to filter</Strong> box at the top of the list: type part of
              a set's name or code to narrow it.
            </Bullet>
            <Bullet>
              <Strong>Version</Strong>: every version of the card in that set, as small pictures under the
              Set box, each with its number and what's special about it (like "Borderless, Showcase"). The one
              showing has an orange outline and a check mark; tap another to pick it. A version that isn't made in
              the language you chose under <Strong>Language</Strong> is grayed out, and one made in only one language
              (like a Japanese alternate-art card) has that language in its corner and is only available once you
              choose it. Tapping a grayed one tells you why. Choose another language and the other versions show
              their pictures in that language.
            </Bullet>
            <Bullet><Strong>Language</Strong> (above the card): the languages that printing was made in.</Bullet>
            <P>The picture changes to match what you pick, and that's the printing that gets added to your binder.</P>
            <P>
              Have the <Strong>foil</Strong> version? Tap the <Strong>Foil</Strong> button under the
              card before adding it to a binder or list. Each tap steps to the next finish that printing
              really comes in: <Strong>not foil</Strong> (the button is grayed out), <Strong>Foil</Strong> (the
              button turns rainbow) and <Strong>Etched</Strong> (the button turns silver; etched foil is a special
              silvery foil only some printings have), then back round. The button can't be pressed when
              the printing comes in only one finish. Foil and etched cards get a rainbow border in your
              binders and lists, and a <Strong>*</Strong> (foil) or <Strong>**</Strong> (etched) after the number in
              the List view.
            </P>
          </>
        ),
      },
      {
        id: 'finder-prices',
        title: 'Prices',
        body: (
          <>
            <P>
              The <Strong>Prices</Strong> box shows what the printing on show costs at three
              stores: <Strong>TCGplayer</Strong>, <Strong>Card Kingdom</Strong> and <Strong>Cardmarket</Strong> (in
              euros). Each has a regular and a foil price; the one that matches
              the <Strong>Foil</Strong> button is highlighted (with Etched chosen, the foil column shows the
              etched price, marked "etched"). The store you chose
              under <Strong>Price store</Strong> in <HelpLink to="settings-prices">Settings</HelpLink> is listed first.
            </P>
            <P>
              Tap <Strong>TCGplayer</Strong> or <Strong>Card Kingdom</Strong> (the icon or the name) to
              see the card there. <Strong>Cardmarket</Strong> shows prices only, with no link, because
              its website blocks many visitors. On a wide screen the box is
              beside the card, on the left, with just the stores' icons; on a narrow screen it's
              under <Strong>Notes and Rules</Strong>, with the stores' names too.
            </P>
            <P>
              Prices change often (TCGplayer and Cardmarket's come from Scryfall, updated about
              once a day), so check the store before buying.
            </P>
          </>
        ),
      },
      {
        id: 'finder-add',
        title: 'Adding to a binder or a list',
        body: (
          <>
            <P>The round <Strong>+</Strong> button beside the card adds it to a binder or a list:</P>
            <Bullet><Strong>Came from a binder's pocket?</Strong> The card goes straight into that pocket.</Bullet>
            <Bullet><Strong>Came from a list (its Add card button)?</Strong> The card goes straight to the end of that list.</Bullet>
            <Bullet>
              <Strong>Opened the finder on its own?</Strong> It first asks <Strong>Add to a binder or a
              list?</Strong> A short list drops down from the <Strong>+</Strong>: tap <Strong>Binder</Strong> or <Strong>List</Strong>, then pick which one:
              each binder or list shows its card count. A binder's card goes into its first empty
              pocket (full binders can't be picked); a list's goes at the end (a list that already
              has the card can't be picked). <Strong>New binder</Strong> or <Strong>New list</Strong> at
              the bottom makes a new one with the card in it.
            </Bullet>
            <P>Afterwards you're taken to the binder (opened to the page with the new card) or the list.</P>
            <P>
              The <Strong>+</Strong> button only shows when you're signed in or using the app
              locally. When you came from a binder or a list, the <Strong>back arrow</Strong> at the top
              left<OnComputer> (or the <Key>B</Key> key on a computer)</OnComputer> takes you back to it. When you're not
              signed in, <Strong>Home</Strong> (the house at the bottom) goes back to the welcome
              screen, where you can sign in.
            </P>
          </>
        ),
      },
      {
        id: 'finder-share',
        title: 'Sharing a card',
        body: (
          <P>
            The <Strong>share button</Strong> (three joined dots) beside the card makes a link to
            this exact printing and language (and foil, if Foil is on). On a phone it opens your
            share menu; on a computer the link is copied, ready to paste. Opening the link shows
            the same card.
          </P>
        ),
      },
      {
        id: 'finder-rules',
        title: 'Rules and legality',
        body: (
          <>
            <Bullet><Strong>Notes and Rules</Strong>: official rulings about how the card works.</Bullet>
            <Bullet>
              <Strong>Format Legality</Strong>: whether the card is allowed in each way of playing
              (Standard, Modern, Commander and more). To show only the formats you play, turn the
              others off in <Strong>Settings → Search → Format legality display</Strong> (the
              gear at the bottom; see <HelpLink to="settings-formats">Format legality display</HelpLink>).
            </Bullet>
          </>
        ),
      },
      {
        id: 'finder-keyboard',
        title: 'Using the keyboard (computers)',
        computerOnly: true,
        body: (
          <>
            <P>
              On a computer, the search box, its list of names, the Set list and the "Add to which
              binder?" menu all work with the arrow keys, <Key>Enter</Key> and <Key>Escape</Key>.
              There are also shortcut keys that work anywhere on the screen, except while you're
              typing in a box:
            </P>
            <Bullet><Key>/</Key>: jump to the search box, ready to type a new name.</Bullet>
            <Bullet><Key>Escape</Key> (in the search box): leave it, so the shortcut keys work.</Bullet>
            <Bullet><Key>[</Key> / <Key>]</Key>: previous / next version in this set.</Bullet>
            {/* The curly brackets are written as text in quotes, because in
                this kind of file a bare { starts a piece of code */}
            <Bullet><Key>{'{'}</Key> / <Key>{'}'}</Key> (Shift + [ / ]): previous / next set.</Bullet>
            <Bullet><Key>F</Key>: flip a two-sided card.</Bullet>
            <Bullet><Key>A</Key>: add to binder (when signed in or using the app locally).</Bullet>
            <Bullet><Key>S</Key>: share a link to this card.</Bullet>
            <Bullet><Key>B</Key>: back to the binder you came from.</Bullet>
            <Bullet><Key>?</Key>: show a list of these keys.</Bullet>
            <P>
              On a computer, the line under the search box reminds you: "<Key>/</Key> search
              · <Key>?</Key> shortcuts". Click it to see the list.
            </P>
          </>
        ),
      },
    ],
  },

  /* ===================== SETTINGS ===================== */
  {
    id: 'settings',
    title: 'Settings',
    lead: (
      <>
        Settings is where you choose how the app looks and works for you. Your choices are
        saved, so they're the same every time you come back.
      </>
    ),
    sections: [
      {
        id: 'settings-open',
        title: 'Opening Settings',
        body: (
          <>
            <P>
              Tap <Strong>Settings</Strong> (the gear) at the bottom right of the screen.
            </P>
            <P>
              Settings are in groups: <Strong>Appearance</Strong>, <Strong>Binders</Strong>, <Strong>Search</Strong>, <Strong>Account</Strong> and <Strong>About</Strong>.
              Each change saves as soon as you make it: there's no Save button. The line at the
              top of the screen says where it was saved.
            </P>
            <P>
              Before you sign in (or choose <Strong>Skip login, local use only</Strong> on Home),
              Settings only has the <Strong>Theme</Strong>: the rest needs somewhere to keep your
              binders first.
            </P>
          </>
        ),
      },
      {
        id: 'settings-theme',
        title: 'Theme (light and dark)',
        body: (
          <>
            <P>Under <Strong>Appearance</Strong>, <Strong>Theme</Strong> has three choices:</P>
            <Bullet><Strong>Dark</Strong>: light text on a dark background, easier on the eyes at night.</Bullet>
            <Bullet>
              <Strong>System</Strong>: match your phone's or computer's own light/dark setting. If
              your device switches by itself (some turn dark in the evening), the app switches
              with it.
            </Bullet>
            <Bullet><Strong>Light</Strong>: dark text on a light background.</Bullet>
            <P>
              <Strong>Full screen</Strong> (website only) hides the browser's
              address bar for more room. Press <Key>Esc</Key> or swipe down from the top to leave it. For
              the address bar to stay hidden every time, install the site as an app: in Chrome or Edge
              choose <Strong>Install app</Strong> (or <Strong>Add to Home screen</Strong>) from the browser's menu; on an
              iPhone or iPad, tap <Strong>Share</Strong>, then <Strong>Add to Home Screen</Strong>. It then opens like
              any other app, with no address bar.
            </P>
            <P>
              Tap (or click) a choice.<OnComputer> On a computer, you can also press <Key>Tab</Key> to reach
              them and <Key>Enter</Key> to pick one.</OnComputer>
            </P>
          </>
        ),
      },
      {
        id: 'settings-prices',
        title: 'Price store',
        body: (
          <>
            <P>
              Under <Strong>Binders</Strong>, <Strong>Price store</Strong> picks whose prices the app
              shows for your cards: <Strong>TCGplayer</Strong> or <Strong>Card Kingdom</Strong> (US
              dollars) or <Strong>Cardmarket</Strong> (euros). Inside a binder, each card in the
              list shows what its copies are worth there (the foil price for a foil copy, times how many copies;
              a dash when the store has no price), and the line above the cards adds it all up: how many
              cards, how many different, and the total value. On the Card Finder, your store's prices are listed first.
            </P>
            <P>
              The first time you pick <Strong>Card Kingdom</Strong>, the app downloads its price list
              (a few megabytes), so its prices can take a moment to appear. The choice is saved with
              your other settings, so it follows you to other phones and computers. Prices change often,
              so check the store before buying.
            </P>
          </>
        ),
      },
      {
        id: 'settings-layout',
        title: 'Page layout',
        body: (
          <>
            <P>
              Under <Strong>Binders</Strong> there are two page layouts, so a phone can have
              bigger pockets than a computer: <Strong>Page layout on a phone</Strong> and <Strong>Page
              layout on a wide screen</Strong>. Each sets how many pockets every binder page
              has: tap <Strong>−</Strong> and <Strong>+</Strong> beside <Strong>Across</Strong> and <Strong>Down</Strong> (1
              to 6 each). For example, 3 × 3 for 9-pocket pages, 4 × 3 for 12, or 3 × 5. Both
              start at 4 × 4 (16 pockets). The small picture under them shows one page, with
              how many cards it holds. In the phone app, cards are always as wide as the screen
              allows, so a page with many rows scrolls up and down. On the website, the whole
              page shrinks to fit the screen.
            </P>
            <P>
              Which one shows depends on the window's width, not on the kind of device: a window
              narrower than 600 wide (a phone held upright, or the website in a narrow window)
              uses the phone layout; anything wider (a computer, a tablet, a phone held
              sideways) uses the wide-screen layout. It switches by itself if you resize the
              window or turn the phone. Your cards stay in the same order whichever layout is
              showing, so the same binder simply has more pages in a smaller layout. Page
              numbers will differ between your phone and your computer.
            </P>
            <P>
              The layouts are the same for all your binders. Changing one keeps every card in the
              same order (pocket 1, 2, 3… counting page by page), so cards flow onto more pages
              (or fewer). A binder keeps its number of pages; if its cards need more, pages are
              added. Change the layout back, and every card returns to exactly where it was.
              Your account remembers both layouts, so they follow you to your other devices.
            </P>
          </>
        ),
      },
      {
        id: 'settings-formats',
        title: 'Format legality display',
        body: (
          <>
            <P>
              Under <Strong>Search</Strong>, <Strong>Format legality display</Strong> has an on/off
              switch for every format (Standard, Modern, Commander and more). Turn off the ones you
              don't play, and they're left out of a card's <Strong>Format Legality</Strong> box in
              the MTG Card Finder (see <HelpLink to="finder-rules">Rules and legality</HelpLink>).
            </P>
            <Bullet><Strong>Show all</Strong> turns every format on again.</Bullet>
            <Bullet>
              <Strong>Hide all</Strong> turns them all off (the Format Legality box then doesn't
              show at all).
            </Bullet>
            <P>A new format added to Magic later shows up turned on, so you won't miss it.</P>
          </>
        ),
      },
      {
        id: 'settings-saving',
        title: 'Where settings are saved',
        body: (
          <>
            <Bullet>
              <Strong>Logged in to your WUBRG'r account</Strong>: with your account on the server. Log
              in on another phone or computer and your theme, page layout and format choices are
              there too. A change made with no internet is kept on this device and sent the next
              time the app syncs.
            </Bullet>
            <Bullet>
              <Strong>Signed in with Google</Strong> (not logged in to an account): in your Google Drive, in a file called
              "WUBRGr settings.json" in the "MTG Card Binder" folder (next to your binders). So
              they follow you: sign in on another phone or computer and your settings are there
              too.
            </Bullet>
            <Bullet><Strong>Using the app locally</Strong>: on this device only.</Bullet>
            <P>
              If your Google sign-in has run out, a change is kept on this device for now, and
              saved to Google Drive the next time you sign in.
            </P>
          </>
        ),
      },
      {
        id: 'settings-account',
        title: 'Your account',
        body: (
          <>
            <P><Strong>Account</Strong> shows how you're using the app:</P>
            <Bullet>
              <Strong>Logged in</Strong>: your username, name and email, a <Strong>Log out</Strong> button
              and <Strong>Log out everywhere</Strong> (which also logs out your other phones and
              computers). Your binders and lists stay on this device. Not logged in, there are{' '}
              <Strong>Log in</Strong> and <Strong>Create account</Strong> buttons. While you're logged
              in, changes are sent to your account every few seconds, and changes from your other
              devices arrive every couple of minutes. With no internet, they wait and are sent later.
              If the same binder was changed on two devices, the device that syncs last keeps its version.
              If this device and your account each have a binder (or list) with the same name but
              different cards, the app asks which to keep, instead of making a "Name 2" copy:{' '}
              <Strong>Combine</Strong> (the cards from both, a card on both counts once; a card
              you moved to another binder may then be in both places), <Strong>Keep this
              device's</Strong>, <Strong>Keep the account's</Strong>, or <Strong>Decide later</Strong>
              {' '}(nothing changes, and it asks again the next time the app opens). A switch
              applies your answer to the other binders or lists with the same problem.
            </Bullet>
            <Bullet>
              <Strong>Google Drive backup</Strong> is optional: sign in with Google to also keep a copy
              of your binders in your own Google Drive, so you can reach your files outside the app.
              The Google items below are about this backup.
            </Bullet>
            <Bullet>
              <Strong>Signed in with Google</Strong>: your Google name and email address, and
              a <Strong>Sign out</Strong> button. Signing out sends any waiting changes to
              Google Drive, disconnects Google, and takes you back to Home. Your binders and
              lists stay on this device.
            </Bullet>
            <Bullet>
              <Strong>On this device only</Strong>: a <Strong>Sign in with Google</Strong> button,
              which compares the binders on this device with your Google Drive. (This works on the
              website now; on phones, it's coming in the full app build.)
            </Bullet>
            <Bullet>
              <Strong>Not connected to Google</Strong>: Google sign-ins last about an hour, and
              you may have signed out. Your binders and lists are still on this device. Tap{' '}
              <Strong>Sign in with Google</Strong> to sync again.
            </Bullet>
            <P>
              <Strong>Which way to sync?</Strong> Your phone keeps your collection for good. Each
              time the app reads Google Drive (signing in, opening The Shelf or Lists, or pulling a
              screen down), it compares the two. If they match, waiting changes just go to Drive.
              If they don't (for example, this is a new install and Drive already has your
              collection, or you changed a binder on the website), a window asks, once for
              everything:
            </P>
            <Bullet>
              <Strong>Phone to Drive</Strong>: Google Drive becomes a copy of this phone.
              Binders and lists that are only in Drive are deleted (moved to the Drive trash,
              where Google keeps them for 30 days).
            </Bullet>
            <Bullet>
              <Strong>Drive to phone</Strong>: this phone becomes a copy of Google Drive.
              Binders and lists that are only on this phone are removed from it.
            </Bullet>
            <Bullet>
              <Strong>Not now</Strong>: nothing changes. You're asked again the next time you
              sign in or pull a screen down.
            </Bullet>
            <P>
              <Strong>Device memory</Strong>, under Account, has <Strong>Reset device memory</Strong>:
              the only way to clear your collection from this device. It asks "Are you sure?",
              removes every binder and list from this device, and signs you out of Google. Your
              files in Google Drive are not touched, and your settings (theme, page layout) are
              kept. Afterwards the app is like a new install: sign in with Google and, if
              Drive has a collection, you choose which way to sync. If you're logged in to your
              WUBRG'r account, its own copy is not touched and your binders come straight
              back down to this device. It also clears the card information saved for
              offline use (it downloads again when needed).
            </P>
            <P>
              <Strong>Card pictures</Strong> (on the phone app only) shows how much space the
              saved card pictures take. Every picture is saved on the phone the first time you see
              it, so it opens instantly, uses no data and works with no internet. The limit is 3 GB;
              when it's full, the pictures you haven't looked at for the longest time are removed
              first. <Strong>Save all my binder pictures</Strong> downloads every picture in your
              binders and lists right now (use Wi-Fi), so everything works offline, and
              {' '}<Strong>Clear saved pictures</Strong> deletes them to free space.
            </P>
            <P>
              <Strong>About</Strong>, under it, shows the app's version and where its card
              information comes from. On the website (not the phone app) it also has a
              {' '}<Strong>Download Android App from Google Drive</Strong> link under the website address.
            </P>
            <P>
              <Strong>Server status</Strong> says whether the WUBRG'r server (the one that keeps
              your account's binders) is running. On the website a small live badge at the right
              end of the row shows it. In the phone app, tap the row to open the status page in
              your browser. If the badge says the server is down, your binders still work on
              this device and sync when it's back.
            </P>
          </>
        ),
      },
    ],
  },
];

// Find the topic an id belongs to: the topic itself, or the topic
// holding the section with that id. (undefined if it's neither.)
export function topicFor(id: string): HelpTopic | undefined {
  return helpTopics.find((t) => t.id === id || t.sections.some((s) => s.id === id));
}
