# WUBRG'r Binder

**Website: [navypirate83.github.io/WUBRGrExpo](https://navypirate83.github.io/WUBRGrExpo/)**
(the phone app's web version; the original web app stays at
[navypirate83.github.io/WUBRGr](https://navypirate83.github.io/WUBRGr/))

A Magic: The Gathering card binder app for **iPhone, Android and the
web**: keep your cards in binders that look and work like real ones,
find any card with the Card Finder, and save everything on your device
(or, on the web, in your own Google Drive).

This repository is the **Expo (React Native)** version of
[WUBRG'r](https://github.com/navypirate83/WUBRGr), which was a React
website, itself a rewrite of the original
[card-binder](https://github.com/navypirate83/card-binder). All three
use the same Google Drive folder and the same `.csv` binder files.

## What it does

- **The Shelf** (a tab): your binders side by side as closed binders,
  with colored covers and Magic symbols, filling the screen as you make
  more. Tap Add binder to make one (name, cover symbol and color), or
  upload a `.csv`. Drag a binder to move it, hold it for Edit and
  Delete, and pull down to load again. Search the cards in every binder.
- **Binder pages**: pockets of cards. Swipe to turn the page (one page on
  a phone, two side by side on a wide screen), change copy counts, see
  foil borders, and rest a finger on a card then slide it to drag it to
  another pocket. Hold a card still for its menu (copies, remove it, or
  move it to another binder). The bell sets a reminder notification
  (phones). On a computer, card pictures can be dropped in from Scryfall
  or EDHREC.
- **Card Finder** (a tab): search any card, pick its set, version and
  language, see its rulings, format legality and prices (TCGplayer, Card
  Kingdom, Cardmarket), share it, and add it to a binder.
- **Settings** (a tab): theme (Dark, System or Light), the binder page
  layout (pockets across × down), which formats show in Format Legality,
  and your account.
- **Help**: the ? button in every screen's header.
- Binders are `.csv` files in the same layout as a ManaBox export (plus
  each card's page and pocket, and the binder's name, cover and pages).

## Running it

You need [Node.js](https://nodejs.org). Then, in this folder:

```sh
npm install        # download the libraries (once)
npm run dev        # start the app at http://localhost:3000 (the web version)
```

To try it **on a phone**, install the free **Expo Go** app, then scan the
QR code that `npm run dev` shows in the terminal (iPhone: with the
Camera app; Android: inside Expo Go). The phone and computer must be on
the same Wi-Fi. If the phone can't connect, try `npx expo start --tunnel`.

Other commands:

- `npm run build`: build the website into `dist` (published to GitHub
  Pages by `.github/workflows/deploy.yml` on every push to `main`)
- `npm run typecheck`: check the code for mistakes

## How it's built

- **Expo** (React Native) with **Expo Router**: one set of code for the
  phone apps and the website (react-native-web draws it in a browser).
- **TanStack Query** for Scryfall card data, **AsyncStorage** for saving
  on the device, **react-native-gesture-handler** and **Reanimated** for
  swipes, holds, drags and the page turn, **expo-notifications** for
  reminders, **expo-image** for card pictures.

## Where things are

- `src/app/`: the screens. Each file is one address: `(tabs)/` holds the
  four tabs (`index.tsx` Home, `binders/` The Shelf and one binder
  (`[id].tsx`), `search.tsx` Card Finder, `settings.tsx`), plus
  `help.tsx`, `lists.tsx` and `decklists.tsx`.
- `src/components/`: pieces of the screens, in folders by screen
  (`binders/`, `binder/`, `search/`, `settings/`, `help/`, `home/`), plus
  shared ones (buttons, text boxes, pop-up windows).
- `src/hooks/`: shared screen behavior (theme colors, settings, who's
  signed in, shortcut keys, screen-reader messages).
- `src/lib/`: plain TypeScript with no React (binder storage, `.csv`
  files, Google Drive, Scryfall, the card-name search, prices, settings,
  reminders). A file ending in `.web.ts` is the web's version of the
  file beside it.
- `src/theme/colors.ts`: the light and dark colors.
- `assets/images/`: the app icon, pictures and store logos.
- `legacy-web/`: the old Vite website's code, kept for reference while
  the move to Expo finishes.

## Card data

Card information and images are provided by [Scryfall](https://scryfall.com).
WUBRG'r Binder is unofficial Fan Content permitted under the
[Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Not approved/endorsed by Wizards. Portions of the materials used are
property of Wizards of the Coast. ©Wizards of the Coast LLC.
