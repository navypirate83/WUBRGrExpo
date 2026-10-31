/* =====================================================================
   THE CARD AREA
   Everything under the search box: the Language picker, the card's
   picture with the round Share and "+" Add to binder buttons beside it,
   the Flip and Foil buttons, the name / set / artist line, the Set and
   Version pickers, the Notes and Rules and Format Legality boxes, and
   the prices.
   It remembers which printing, side and language is showing. The Card
   Finder draws a fresh one for every card looked up, so each new card
   starts on the printing Scryfall found.
   Before any card is looked up, it shows the back of a card and
   greyed-out pickers.
   On a phone the Share and "+" buttons float just inside the card's
   right edge; on a wider screen (a tablet or computer) they sit beside
   the card, and the prices sit in a box to the card's left.
   ===================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadLanguages, type ScryfallCard } from '@/lib/scryfall';
import {
  CARD_BACK, cardSearchParams, faceName, foilChoices, foilFor, groupBySet, imageFor,
  isDoubleSided, languageName, versionLabel, type SetGroup,
} from '@/lib/cards';
import type { BinderCard } from '@/lib/binderStorage';
import { openLink, shareLink } from '@/lib/links';
import { hapticTap } from '@/lib/haptics';
import { useShortcutKeys } from '@/hooks/useShortcutKeys';
import { useColors } from '@/hooks/useTheme';
import { MAX_CONTENT_WIDTH } from '@/theme/colors';
import Button from '@/components/Button';
import SetPicker, { EMPTY_PICKER_TEXT } from './SetPicker';
import CardPicture from './CardPicture';
import { Legality, Rulings } from './CardNotes';
import AddToBinder, { type AddToBinderHandle } from './AddToBinder';
import PricePanel from './PricePanel';
import { PickerButton, PickerSheet, SheetRowText } from './PickerSheet';
import { PAGE_WIDTH } from './SearchBox';

// How long "Link copied!" stays visible (2 seconds)
const TOAST_MS = 2000;

// The app's public web address for the Card Finder. A shared link
// always points here, so it opens in any browser, even when it was
// shared from the phone app.
const PUBLIC_SEARCH_ADDRESS = 'https://navypirate83.github.io/WUBRGrExpo/search';

// The card picture is never wider than this (in points)
const CARD_MAX_WIDTH = 400;

type Props = {
  // The card that was looked up and all its printings (missing before a
  // search)
  result?: { card: ScryfallCard; prints: ScryfallCard[] };
  // A shared link can ask for the back side or another language
  startFace: number;
  startLang: string | null;
  // Each set's symbol picture (once it has downloaded)
  setIcons?: Map<string, string>;
  // Is Foil on? It's kept by the Card Finder, so it carries on to the
  // next card looked up (the same as the original site).
  foil: boolean;
  setFoil: (on: boolean) => void;
  // A card is being looked up (shows the spinner)
  busy: boolean;
  // Say something to screen readers
  announce: (text: string) => void;
  // Is someone using the binders (so the "+" Add to binder shows)?
  usingBinders: boolean;
  // The binder this screen was opened from, and the pocket to fill, if any
  fromBinder: string | null;
  pocket: { page: number; slot: number } | null;
  // Show a message under the search box (red if it's a problem), or
  // clear it (null)
  onMessage: (text: string | null, isError?: boolean) => void;
};

export default function CardPanel(props: Props) {
  const { result, startFace, startLang, setIcons, foil, setFoil, busy, announce } = props;
  const { usingBinders, fromBinder, pocket, onMessage } = props;
  const colors = useColors();
  // The "+" Add to binder button (the A key presses it)
  const addRef = useRef<AddToBinderHandle>(null);

  // How much room there is, to decide where the buttons and prices go:
  // the width of the area the card sits in, the card's own width, and
  // the room left over on each side of it
  const { width } = useWindowDimensions();
  const areaWidth = Math.min(width, MAX_CONTENT_WIDTH) - 32;
  const cardWidth = Math.min(CARD_MAX_WIDTH, areaWidth);
  const besideWidth = (areaWidth - cardWidth) / 2;
  const buttonsBeside = besideWidth >= 64;    // room for a 48-point button and a gap
  const pricesBeside = besideWidth >= 212;    // room for the narrow price box
  const pickersSideBySide = Math.min(areaWidth, PAGE_WIDTH) >= 600;

  // The card's printings, grouped by set, newest set first. (useMemo
  // only redoes this when the printings or the set symbols change.)
  const sets = useMemo(
    () => (result ? groupBySet(result.prints, setIcons) : []),
    [result, setIcons],
  );

  // Where to start: the printing Scryfall found (for a name search,
  // usually the newest one; for a shared link, the exact one).
  const startPrint = useMemo(() => {
    if (!result || sets.length === 0) return null;
    return sets.flatMap((s) => s.prints).find((p) => p.id === result.card.id) ?? sets[0].prints[0];
  }, [result, sets]);

  // What's showing: which printing, which side (0 = front, 1 = back) and
  // which language (null = the printing's own language). Each starts
  // from the values above when this card area is first drawn.
  const [printId, setPrintId] = useState(startPrint?.id ?? null);
  const [face, setFace] = useState(startPrint && isDoubleSided(startPrint) ? startFace : 0);
  const [lang, setLang] = useState(startLang);

  // Which pick list is open (the Language or Version sheet), if any.
  // (The Set picker keeps track of its own.)
  const [openSheet, setOpenSheet] = useState<'language' | 'version' | null>(null);

  // The printing and set that go with printId
  const print = sets.flatMap((s) => s.prints).find((p) => p.id === printId) ?? startPrint;
  const currentSet: SetGroup | null = sets.find((s) => print && s.prints.includes(print)) ?? null;

  // Every language this exact printing was made in (downloaded in the
  // background; until then, just its own language, greyed out)
  const languages = useQuery({
    queryKey: ['languages', print?.set, print?.collector_number],
    queryFn: () => loadLanguages(print!, languageName),
    enabled: Boolean(print),
  });
  // The language version being shown (the printing itself if it's in its
  // own language, or the languages haven't loaded yet)
  const shown = (lang && languages.data?.find((v) => v.lang === lang)) || print;

  // Is Foil on for this printing? (Foil-only printings are always on;
  // printings with no foil version are always off.)
  const foilOn = print ? foilFor(print, foil) : false;
  const { canBeFoil, onlyFoil } = print ? foilChoices(print) : { canBeFoil: false, onlyFoil: false };

  // Whenever the printing changes, remember Foil the way it now shows
  // (so it carries on to the next version, the same as the original).
  // This runs only when the printing changes ([print?.id]), not every
  // time Foil does.
  useEffect(() => {
    if (print) setFoil(foilFor(print, foil));
  }, [print?.id]);

  // Switch to another printing: front side, in its own language.
  function selectPrint(next: ScryfallCard) {
    setPrintId(next.id);
    setFace(0);
    setLang(null);
  }

  // Switch to another set, on its first printing.
  function selectSet(set: SetGroup) {
    selectPrint(set.prints[0]);
  }

  // Flip a two-sided card over (with a small tap felt in the phone).
  function flip() {
    hapticTap();
    setFace(face === 0 ? 1 : 0);
  }

  /* ----- Sharing a link to the card ----- */

  // The "Link copied!" message beside the Share button (web only: phones
  // show their own Share menu instead)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function showToast(message: string) {
    setToast(message);
    announce(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }
  // Stop the timer if the card area goes away.
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Tapping Share: on a phone, open its Share menu with a link to this
  // exact card (set, version, side, language and foil). In a browser,
  // use its share menu if it has one, or copy the link (see lib/links).
  async function share() {
    if (!print || !shown) return;
    const params = cardSearchParams(print, face, shown.lang, foilOn);
    const url = `${PUBLIC_SEARCH_ADDRESS}?${params}`;
    const title = `${print.name} — ${print.set_name}`;
    const outcome = await shareLink(url, title);
    if (outcome === 'copied') showToast('Link copied!');
  }

  /* ----- Adding the card to a binder ----- */

  // The card being shown, as a binder saves it: this exact set, version,
  // side and language, whether it's foil, the picture for the pocket
  // (the smaller "normal" size is plenty, and downloads faster), when
  // it's added (now), and the set's name and the card's rarity (two of
  // the binder file's columns: see binderCsv.ts).
  function cardEntry(): BinderCard {
    const side = isDoubleSided(print!) ? face : 0;
    return {
      name: print!.name,
      set: print!.set,
      number: print!.collector_number,
      face: side,
      lang: shown!.lang !== print!.lang ? shown!.lang : undefined,   // only saved if switched
      foil: foilOn ? true : undefined,                              // only saved if foil
      image: imageFor(shown!, side, ['normal', 'large']) ?? CARD_BACK,
      added: new Date().toISOString(),
      extra: { 'Set name': print!.set_name, ...(print!.rarity && { Rarity: print!.rarity }) },
    };
  }

  /* ----- Shortcut keys for the card (computers only: see the Keyboard shortcuts window) ----- */

  // Show the version a step before (-1) or after (+1) the one showing,
  // in this set. It stops at the first and last (no wrapping around).
  function stepVersion(step: number) {
    const prints = currentSet!.prints;
    const index = prints.indexOf(print!);
    const next = prints[index + step];
    if (!next) {
      announce(prints.length === 1 ? 'This set has only one version.'
        : step > 0 ? 'This is the last version in this set.' : 'This is the first version in this set.');
      return;
    }
    selectPrint(next);
    announce(`Version ${index + step + 1} of ${prints.length}: ${versionLabel(next)}`);
  }

  // Show the set a step before (-1) or after (+1) the one showing.
  function stepSet(step: number) {
    const index = sets.indexOf(currentSet!);
    const next = sets[index + step];
    if (!next) {
      announce(sets.length === 1 ? 'This card was printed in only one set.'
        : step > 0 ? 'This is the last set.' : 'This is the first set.');
      return;
    }
    selectSet(next);
    announce(`Set ${index + step + 1} of ${sets.length}: ${next.name}`);
  }

  //  [ / ]  previous / next version     { / }  previous / next set
  //  F      flip a two-sided card       S      share
  //  A      add to binder               B      back to the binder you came from
  useShortcutKeys((event) => {
    const key = event.key;
    if (key === 'b' || key === 'B') {
      if (!usingBinders || !fromBinder) { announce('There\'s no binder to go back to.'); return; }
      event.preventDefault();
      router.navigate(`/binders/${encodeURIComponent(fromBinder)}`);
      return;
    }
    if (!['[', ']', '{', '}', 'f', 'F', 's', 'S', 'a', 'A'].includes(key)) return;
    event.preventDefault();
    if (!print || !shown) { announce('Search for a card first.'); return; }
    if (key === 'a' || key === 'A') {
      if (!usingBinders) { announce('Sign in, or use the app locally, to add cards to a binder.'); return; }
      addRef.current?.activate();
      return;
    }
    if (key === '[' || key === ']') stepVersion(key === ']' ? 1 : -1);
    else if (key === '{' || key === '}') stepSet(key === '}' ? 1 : -1);
    else if (key === 'f' || key === 'F') {
      if (!isDoubleSided(print)) { announce('This card has only one side.'); return; }
      const next = face === 0 ? 1 : 0;
      setFace(next);
      announce(`Showing the ${next === 1 ? 'back' : 'front'}: ${faceName(print, next)}`);
    } else {
      share();
      announce('Sharing a link to this card.');
    }
  });

  /* ----- What's drawn ----- */

  // The picture for the side and language showing (null: the card back)
  const pictureUrl = shown ? imageFor(shown, face) : null;
  const pictureAlt = shown ? `${faceName(shown, face)} — ${shown.set_name}` : '';
  // The languages to offer: the downloaded list, or just this one
  const languageOptions = languages.data ?? (print ? [print] : []);
  const currentLanguage = languageOptions.find((v) => v.lang === shown?.lang) ?? null;

  // Where the round buttons go: just past the card's right edge (wide
  // screens), or just inside it (phones)
  const buttonSide = buttonsBeside ? styles.besideLeft : styles.insideRight;

  // The Share button, the "+" and the "Link copied!" message, placed a
  // third and two thirds of the way down the card
  const roundButtons = print && (
    <>
      <View style={[styles.spot, styles.oneThird, buttonSide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share a link to this card"
          onPress={share}
          style={({ pressed }) => [
            styles.round,
            {
              // A little see-through when it floats on the card
              backgroundColor: buttonsBeside ? colors.surface : `${colors.surface}d9`,
              borderColor: colors.border, boxShadow: colors.shadow,
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="share-social" size={22} color={colors.text} />
        </Pressable>
        {/* "Link copied!" just under the Share button */}
        {toast && (
          <View style={[styles.toast, buttonsBeside ? styles.toastLeft : styles.toastRight, { backgroundColor: colors.accent }]}
                pointerEvents="none">
            <Text style={[styles.toastText, { color: colors.accentText }]}>{toast}</Text>
          </View>
        )}
      </View>

      {/* "+": only for someone using the binders, once a card is showing */}
      {usingBinders && (
        <View style={[styles.spot, styles.twoThirds, buttonSide]}>
          <AddToBinder ref={addRef} cardEntry={cardEntry} fromBinder={fromBinder} pocket={pocket} onMessage={onMessage} />
        </View>
      )}
    </>
  );

  return (
    <View>
      {/* LANGUAGE: the languages this printing was made in. Greyed out
          while the list loads, or when there's only one. */}
      <PickerButton
        label="Language"
        inline
        disabled={!shown || languageOptions.length < 2}
        accessibilityLabel={`Language: ${shown ? languageName(shown.lang) : EMPTY_PICKER_TEXT}`}
        onPress={() => { Keyboard.dismiss(); setOpenSheet('language'); }}
        style={[styles.languagePicker, { maxWidth: cardWidth }]}
      >
        <SheetRowText text={shown ? languageName(shown.lang) : EMPTY_PICKER_TEXT} />
      </PickerButton>

      {/* THE CARD, with the prices to its left (wide screens) and the
          round Share and "+" buttons beside it. The card stays centered
          either way. */}
      <View style={styles.stage}>
        {/* PRICES beside the card (just the stores' icons) */}
        {buttonsBeside && (
          <View style={[styles.sideColumn, styles.leftColumn, { width: besideWidth }]}>
            {print && pricesBeside && <PricePanel print={print} foil={foilOn} layout="side" />}
          </View>
        )}

        {/* The card itself, and on phones the round buttons on top of it */}
        <View style={{ width: cardWidth }}>
          <CardPicture src={pictureUrl} alt={pictureAlt} busy={busy} />
          {!buttonsBeside && roundButtons}
        </View>

        {/* Wide screens: the round buttons beside the card */}
        {buttonsBeside && (
          <View style={[styles.sideColumn, { width: besideWidth }]}>{roundButtons}</View>
        )}
      </View>

      {/* FLIP (two-sided cards only) and FOIL, side by side under the card */}
      {print && (
        <View style={styles.cardToggles}>
          {isDoubleSided(print) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Flip card"
              onPress={flip}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: pressed ? colors.surfaceHover : colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.pillText, { color: colors.text }]}>Flip card ↻</Text>
            </Pressable>
          )}
          {/* Foil OFF looks "ghosted" (see-through, with a dashed
              outline); ON it's filled with the bright orange and has
              black text (the same orange in both themes, so the black
              text is always easy to read). Can't be pressed when the
              printing has no foil version (very faint), or ONLY comes
              in foil (it stays on). */}
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Foil"
            accessibilityState={{ checked: foilOn, disabled: !canBeFoil || onlyFoil }}
            accessibilityHint={!canBeFoil ? 'This printing has no foil version'
              : onlyFoil ? 'This printing only comes in foil' : 'I have the foil version'}
            disabled={!canBeFoil || onlyFoil}
            onPress={() => { hapticTap(); setFoil(!foilOn); }}
            style={({ pressed }) => [
              styles.pill,
              foilOn ? styles.foilOn : [styles.foilOff, { borderColor: colors.border }],
              !foilOn && !canBeFoil && styles.foilNone,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.pillText, styles.foilText, { color: foilOn ? '#000000' : colors.text }]}>Foil</Text>
          </Pressable>
        </View>
      )}

      {/* The card's name, set, number and artist, and a link to Scryfall */}
      {print && (
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.text }]} accessibilityRole="header">{print.name}</Text>
          <Text style={[styles.cardDetails, { color: colors.muted }]}>
            {print.set_name} · #{print.collector_number}
            {print.artist ? ` · Illustrated by ${print.artist}` : ''}
          </Text>
          <Button kind="plain" label="View on Scryfall" icon="open-outline"
                  accessibilityLabel="View on Scryfall (opens a browser)" onPress={() => openLink(print.scryfall_uri)} />
        </View>
      )}

      {/* SET and VERSION: side by side on wider screens */}
      <View style={[styles.section, styles.pickers, pickersSideBySide && styles.pickersRow]}>
        <View style={pickersSideBySide ? styles.half : undefined}>
          <SetPicker sets={sets} current={currentSet} onChoose={selectSet} />
        </View>
        <PickerButton
          label="Version"
          disabled={!currentSet}
          accessibilityLabel={`Version: ${print && currentSet ? versionLabel(print) : EMPTY_PICKER_TEXT}`}
          onPress={() => { Keyboard.dismiss(); setOpenSheet('version'); }}
          style={pickersSideBySide ? styles.half : undefined}
        >
          <SheetRowText text={print && currentSet ? versionLabel(print) : EMPTY_PICKER_TEXT} />
        </PickerButton>
      </View>

      {/* NOTES AND RULES, the PRICES (under Notes and Rules when there's
          no room beside the card, with the stores' names) and FORMAT
          LEGALITY: only once a card is showing */}
      <View style={styles.section}>
        {result && <Rulings card={result.card} />}
        {print && !pricesBeside && <PricePanel print={print} foil={foilOn} layout="below" />}
        {print && <Legality print={print} />}
      </View>

      {/* The Language list (drawn only while open) */}
      {openSheet === 'language' && (
        <PickerSheet
          title="Language"
          items={languageOptions}
          current={currentLanguage}
          keyOf={(v) => v.lang}
          labelOf={(v) => languageName(v.lang)}
          renderRow={(v, isCurrent) => <SheetRowText text={languageName(v.lang)} bold={isCurrent} />}
          onPick={(v) => { setLang(v.lang); setOpenSheet(null); }}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {/* The Version list for the set showing (drawn only while open) */}
      {openSheet === 'version' && currentSet && (
        <PickerSheet
          title={`Version (${currentSet.name})`}
          items={currentSet.prints}
          current={print}
          keyOf={(p) => p.id}
          labelOf={versionLabel}
          renderRow={(p, isCurrent) => <SheetRowText text={versionLabel(p)} bold={isCurrent} />}
          onPick={(p) => { selectPrint(p); setOpenSheet(null); }}
          onClose={() => setOpenSheet(null)}
        />
      )}
    </View>
  );
}

// The look of the card area. "spot" is the place for one round button:
// its middle a third (or two thirds) of the way down the card (the top
// is put there, then pulled back up by half the button's 48 points).
const styles = StyleSheet.create({
  languagePicker: { width: '100%', alignSelf: 'center', marginTop: 10 },
  stage: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  sideColumn: { position: 'relative' },
  leftColumn: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 12 },
  spot: { position: 'absolute', marginTop: -24 },
  oneThird: { top: '33.333%' },
  twoThirds: { top: '66.667%' },
  besideLeft: { left: 12 },
  insideRight: { right: 10 },
  round: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  toast: { position: 'absolute', top: 56, width: 110, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  toastText: { fontSize: 13, textAlign: 'center' },
  toastLeft: { left: 0 },
  toastRight: { right: 0 },
  cardToggles: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 },
  pill: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center', borderWidth: 1 },
  pillText: { fontSize: 15 },
  foilText: { fontWeight: '600' },
  foilOn: { backgroundColor: '#e38a5c', borderColor: '#e38a5c' },
  foilOff: { borderStyle: 'dashed', opacity: 0.55 },
  foilNone: { opacity: 0.25 },
  cardInfo: { alignItems: 'center', marginTop: 12, gap: 2 },
  cardName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  cardDetails: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  section: { width: '100%', maxWidth: PAGE_WIDTH, alignSelf: 'center' },
  pickers: { gap: 14, marginTop: 16 },
  pickersRow: { flexDirection: 'row' },
  half: { flex: 1, minWidth: 0 },
});
