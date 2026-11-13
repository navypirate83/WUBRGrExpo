# WUBRG'r Binder

**Website: [navypirate83.com/wubrgr](https://navypirate83.com/wubrgr/)**
(the phone app's web version, published with GitHub Pages)

**Server: [wubrgr-server.onrender.com](https://wubrgr-server.onrender.com/api/health)**
(accounts and saved collections; hosted on Render, status at
[stats.uptimerobot.com/WQDbcwUml0](https://stats.uptimerobot.com/WQDbcwUml0))

A Magic: The Gathering card binder app for **iPhone, Android and the
web**: keep your cards in binders that look and work like real ones,
find any card with the Card Finder, and keep everything in your own
WUBRG'r account (with a copy on your device, so it works offline). A
Google Drive backup is optional.

This repository is the **Expo (React Native)** version of
[WUBRG'r](https://github.com/navypirate83/WUBRGr), which was a React
website, itself a rewrite of the original
[card-binder](https://github.com/navypirate83/card-binder). All three
use the same `.csv` binder files, and the optional Google Drive backup
uses the same Drive folder.

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
  and your account (log in, log out, optional Google Drive backup).
- **Help**: the ? button in every screen's header.
- Binders are `.csv` files in the same layout as a ManaBox export (plus
  each card's page and pocket, and the binder's name, cover and pages).

## Logging in

On the Home screen, **Login** with your username (or email) and password,
or **Create account** (name, email, a password of 8+ characters, and an
optional username). **Forgot username/password?** emails a 6-digit reset
code. **Skip login, local use only** uses the app with binders on that
device only; you can log in later and they are moved up to your account.

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

### The server (`server/` folder)

An Express + MongoDB server keeps the accounts, binders, lists and
settings. The published app and website use the one on Render (set by
`EXPO_PUBLIC_API_URL`); without that setting, the app looks for a server
on `http://localhost:4100`. To run your own:

```sh
cd server
npm install        # once
# copy .env.example to .env and fill in MONGODB_URI, JWT_SECRET,
# GOOGLE_CLIENT_ID and CORS_ORIGINS (never commit .env)
npm start          # listens on port 4100 (PORT in .env changes it)
npm test           # automated checks, on a separate "-test" database
```

Check it is up at `/api/health` (answers `{"ok":true}`).

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
- `server/`: the Express + MongoDB server (`routes/`, `models/`,
  `middleware/`, `tests/`).
- `src/lib/`: plain TypeScript with no React (binder storage, `.csv`
  files, server sync, Google Drive, Scryfall, the card-name search, prices, settings,
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
