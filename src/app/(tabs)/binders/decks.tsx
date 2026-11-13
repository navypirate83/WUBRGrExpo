/* =====================================================================
   DECKS (/binders/decks)
   The third page of The Shelf, after Binders and Lists. From top to
   bottom: the search bar (it searches your decks' names AND the cards
   inside them), the "Add deck" button, then your decks, one row each.
   - on a phone its header has the same small Binders / Lists / Decks
     buttons as the other two pages (see ShelfSwitch.tsx and
     binders/_layout.tsx), and on a wide screen the side menu lists Decks
     under Lists and highlights it here (see SideMenu.tsx)
   - "Add deck" asks for a name and a format (Commander, Modern...), then
     opens the new deck
   - tap a row to open the deck
   - press and HOLD a row for its options: Rename and Delete (it asks first)
   Each row is plain, like the Lists page: the deck's name in bold, its
   format and how many cards it has under that, and an arrow.
   Decks are saved on this device and in your account (see deckStorage.ts
   and serverSync.ts).
   ===================================================================== */

import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { useAccount } from '@/hooks/useAccount';
import DeckSearch from '@/components/decks/DeckSearch';
import PopupWindow from '@/components/PopupWindow';
import TextField from '@/components/TextField';
import Button from '@/components/Button';
import NewDeckDialog from '@/components/decks/NewDeckDialog';
import { addDeck, forgetDeck, loadDecks, renameDeck, type Deck } from '@/lib/deckStorage';
import { deckFormat } from '@/lib/deckFormats';
import { cardCountText } from '@/lib/binderStorage';
import { askYesNo } from '@/lib/dialogs';
import { hapticTap } from '@/lib/haptics';
import { RADIUS } from '@/theme/colors';
import SymbolText from '@/components/SymbolText';

// The page is never wider than the shelf of binders (points), with the
// same space around its edge
const PAGE_MAX_WIDTH = 1400;
const PAGE_PADDING = 16;

// The longest a deck's name can be
const NAME_LIMIT = 40;

// How many cards a deck holds, counting every copy
const cardsIn = (deck: Deck) => deck.cards.reduce((sum, card) => sum + (card.count ?? 1), 0);

// Opening a deck: its page slides in over this one
function openDeck(id: string) {
  router.push(`/binders/deck/${encodeURIComponent(id)}` as never);
}

export default function DecksScreen() {
  const colors = useColors();
  const { usingBinders } = useAccount();
  // The decks, the new deck being made (its name and format), and which
  // window is open: a held deck's options, or Rename (with the name being typed)
  const [decks, setDecks] = useState<Deck[]>(loadDecks);
  const [making, setMaking] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  // Every time this page comes into view (a deck's cards may have changed)
  useFocusEffect(useCallback(() => { setDecks(loadDecks()); }, []));

  // "Create" in the new deck window: make it and open it
  function create(name: string, format: string) {
    const id = addDeck(name, format);
    setMaking(false);
    setDecks(loadDecks());
    openDeck(id);
  }

  // "Save" in the Rename window
  function saveName() {
    if (!renaming) return;
    renameDeck(renaming.id, renaming.name);
    setRenaming(null);
    setDecks(loadDecks());
  }

  // "Delete" in a deck's options: ask first
  async function confirmDelete(deck: Deck) {
    setMenuId(null);
    const yes = await askYesNo(`Delete ${deck.name}?`, `It has ${cardCountText(cardsIn(deck))}. This can't be undone.`, 'Yes, delete', 'No');
    if (!yes) return;
    forgetDeck(deck.id);
    setDecks(loadDecks());
  }

  // Not signed in and not using the app on this device: the shelf shows how to start
  if (!usingBinders) return <Redirect href="/binders" />;

  const menuDeck = menuId ? decks.find((d) => d.id === menuId) : undefined;

  return (
    // The keyboard pushes everything up instead of covering the search bar
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={decks}
        keyExtractor={(deck) => deck.id}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        // At the top: the search bar (drawn over the decks below, so its
        // drop-down can cover them), and Add deck
        ListHeaderComponent={
          <View style={styles.header}>
            <DeckSearch onPick={openDeck} />
            <Button label="Add deck" icon="add" onPress={() => setMaking(true)} />
          </View>
        }
        ListHeaderComponentStyle={styles.headerOnTop}
        // No decks yet: an intentional empty page, not a blank screen
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Image source={require('../../../../assets/images/deckbox-outline.svg')} style={styles.emptyPicture}
                   contentFit="contain" tintColor={colors.muted} accessible={false} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No decks yet</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>Tap Add deck above to start one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          // One deck: tap to open, hold for its options
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${deckFormat(item.format).name}, ${cardCountText(cardsIn(item))}`}
            accessibilityHint="Opens the deck. Hold for Rename and Delete."
            onPress={() => openDeck(item.id)}
            onLongPress={() => { hapticTap(); setMenuId(item.id); }}
            delayLongPress={500}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceHover : colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <SymbolText style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</SymbolText>
              <Text style={[styles.rowCount, { color: colors.muted }]}>{deckFormat(item.format).name} · {cardCountText(cardsIn(item))}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.muted} />
          </Pressable>
        )}
      />

      {/* Add deck: a name, and the format to build it for */}
      {making && <NewDeckDialog onCreate={create} onCancel={() => setMaking(false)} />}

      {/* A held deck's options: Rename and Delete */}
      {menuDeck && (
        <PopupWindow title={menuDeck.name} onClose={() => setMenuId(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuId(null), kind: 'secondary' }]}>
          <View style={styles.menu}>
            <Button label="Rename" icon="create-outline" kind="secondary"
                    onPress={() => { setMenuId(null); setRenaming({ id: menuDeck.id, name: menuDeck.name }); }} />
            <Button label="Delete" icon="trash-outline" kind="danger" onPress={() => confirmDelete(menuDeck)} />
          </View>
        </PopupWindow>
      )}

      {/* Rename: the name in a box, then Save (or Cancel to keep it) */}
      {renaming && (
        <PopupWindow title="Rename deck" onClose={() => setRenaming(null)}
                     buttons={[
                       { label: 'Cancel', onPress: () => setRenaming(null), kind: 'secondary' },
                       { label: 'Save', onPress: saveName, disabled: !renaming.name.trim() },
                     ]}>
          <TextField
            label="Name"
            value={renaming.name}
            onChangeText={(name) => setRenaming({ ...renaming, name })}
            onSubmitEditing={saveName}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            maxLength={NAME_LIMIT}
            autoCapitalize="words"
          />
        </PopupWindow>
      )}
    </KeyboardAvoidingView>
  );
}

// The page's look, matching the Lists page
const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: PAGE_PADDING, gap: 12, width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center', flexGrow: 1 },
  header: { gap: 10, marginBottom: 4 },
  headerOnTop: { zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: RADIUS * 1.2, borderWidth: 1 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 18, fontWeight: '700' },
  rowCount: { fontSize: 14 },
  menu: { gap: 8 },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS * 1.4, marginTop: 8 },
  emptyPicture: { width: 74, height: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
