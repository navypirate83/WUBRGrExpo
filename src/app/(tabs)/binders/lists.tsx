/* =====================================================================
   LISTS (/binders/lists)
   The other side of The Shelf tab: your card lists (a want list, cards
   to trade, upgrades for a deck...). From top to bottom: the Binders /
   Lists switch (here the Lists button is faded, and the Binders one goes
   back to the shelf), the search bar (it searches your lists' names),
   the "Add list" button, then your lists, one row each, and a message
   line (only when something went wrong).
   Each row is plain (no colors or icons): the list's name in bold, how
   many cards it has under that, and an arrow.
   - tap a row to open the list
   - press and HOLD a row for its options: Rename (a small window with
     the name in a box) and Delete (it asks first)
   - pull the page DOWN to load the lists again (from Google Drive, when
     signed in)
   Lists are saved like binders: in Google Drive when signed in, or on
   this device only (see listStorage.ts and googleDrive.ts). With no
   lists yet, the page says so, with a picture of a notebook.
   ===================================================================== */

import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { useAccount } from '@/hooks/useAccount';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import ListSearch from '@/components/lists/ListSearch';
import PopupWindow from '@/components/PopupWindow';
import TextField from '@/components/TextField';
import Button from '@/components/Button';
import {
  addListToDevice, forgetList, loadLists, nextListName, renameList, type CardList,
} from '@/lib/listStorage';
import { DriveError, createListFile, syncList, trashListFile } from '@/lib/googleDrive';
import { reconcileWithDrive } from '@/lib/driveSync';
import { cardCountText } from '@/lib/binderStorage';
import { askYesNo } from '@/lib/dialogs';
import { hapticTap } from '@/lib/haptics';
import { RADIUS } from '@/theme/colors';

// The page is never wider than the shelf of binders (points), with the
// same space around its edge
const PAGE_MAX_WIDTH = 1400;
const PAGE_PADDING = 16;

// The longest a list's name can be
const NAME_LIMIT = 40;

// Opening a list: its page slides in over this one
function openList(id: string) {
  router.push(`/binders/list/${encodeURIComponent(id)}` as never);
}

export default function ListsScreen() {
  const colors = useColors();
  const { usingBinders, localMode } = useAccount();
  // The lists (this device's copy to start, then Drive's once loaded),
  // the message line (red: something went wrong), whether a new list is
  // being made, and whether the page is being pulled down to load again
  const [lists, setLists] = useState<CardList[]>(loadLists);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Which window is open: a held list's options, or Rename (with the
  // name being typed)
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  // Something went wrong talking to Google Drive: say what, in plain words
  function problem(err: unknown, what: string) {
    setMessage(err instanceof DriveError && err.signedOut
      ? 'Your Google sign-in has run out. Sign in again on the Home tab.'
      : `${what} ${(err as Error).message}`);
  }

  // Load the lists again: this device's copy first, then compare with
  // Google Drive (see lib/driveSync.ts). If they differ, a window asks
  // which way to sync; no list on this device is removed unless the
  // person chooses "Drive to phone". "fromUser" is true when pulling the
  // page down, which asks again after a "Not now".
  const reload = useCallback(async (fromUser = false) => {
    setLists(loadLists());
    if (localMode) return;
    try {
      await reconcileWithDrive({ fromUser });
      setLists(loadLists());
      setMessage('');
    } catch (err) {
      problem(err, 'Couldn\'t load your lists from Google Drive.');
    }
  }, [localMode]);

  // Every time this page comes into view (a list's cards may have changed)
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Pulling the page down: load again, with the spinning wheel showing
  async function refresh() {
    setRefreshing(true);
    await reload(true);
    setRefreshing(false);
  }

  // "Add list": make a list called "List 1" (or the next free number), in
  // Drive when signed in, then open the Rename window to name it
  async function add() {
    setAdding(true);
    const name = nextListName();
    try {
      const file = await createListFile(name);
      addListToDevice(file.id, name);
      setLists(loadLists());
      setMessage('');
      setRenaming({ id: file.id, name });
    } catch (err) {
      problem(err, 'Couldn\'t make the list in Google Drive.');
    }
    setAdding(false);
  }

  // "Save" in the Rename window: keep the new name here, then in Drive
  async function saveName() {
    if (!renaming) return;
    const { id, name } = renaming;
    setRenaming(null);
    renameList(id, name);
    setLists(loadLists());
    try {
      await syncList(id);
    } catch (err) {
      problem(err, 'Couldn\'t save the new name to Google Drive.');
    }
  }

  // "Delete" in a list's options: ask, then move its file to the Drive
  // trash (when signed in) and forget it here
  async function confirmDelete(list: CardList) {
    setMenuId(null);
    const yes = await askYesNo(`Delete ${list.name}?`,
      `It has ${cardCountText(list.cards.length)}.${localMode ? ' This can\'t be undone.' : ' It goes to your Google Drive trash.'}`,
      'Yes, delete', 'No');
    if (!yes) return;
    try {
      await trashListFile(list.id);
      forgetList(list.id);
      setLists(loadLists());
    } catch (err) {
      problem(err, 'Couldn\'t delete the list.');
    }
  }

  // Not signed in and not using the app on this device: the shelf shows
  // how to start (lists are saved the same way as binders)
  if (!usingBinders) return <Redirect href="/binders" />;

  const menuList = menuId ? lists.find((l) => l.id === menuId) : undefined;

  return (
    // The keyboard pushes everything up instead of covering the search bar
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={lists}
        keyExtractor={(list) => list.id}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        // Pull down to load the lists again
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
        // At the top: the switch, the search bar (drawn over the lists
        // below, so its drop-down can cover them), and Add list
        ListHeaderComponent={
          <View style={styles.header}>
            <ShelfSwitch current="lists" />
            <ListSearch onPick={openList} />
            <Button label="Add list" icon="add" onPress={add} disabled={adding} />
          </View>
        }
        ListHeaderComponentStyle={styles.headerOnTop}
        // No lists yet: an intentional empty page, not a blank screen
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Image source={require('../../../../assets/images/notebook-outline.svg')} style={styles.emptyPicture}
                   contentFit="contain" tintColor={colors.muted} accessible={false} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No lists yet</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>Tap Add list above to start one.</Text>
          </View>
        }
        // The message line, only when something went wrong
        ListFooterComponent={message ? <Text style={[styles.message, { color: colors.error }]}>{message}</Text> : undefined}
        renderItem={({ item }) => (
          // One list: tap to open, hold for its options
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${cardCountText(item.cards.length)}`}
            accessibilityHint="Opens the list. Hold for Rename and Delete."
            onPress={() => openList(item.id)}
            onLongPress={() => { hapticTap(); setMenuId(item.id); }}
            delayLongPress={500}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceHover : colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.rowCount, { color: colors.muted }]}>{cardCountText(item.cards.length)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.muted} />
          </Pressable>
        )}
      />

      {/* A held list's options: Rename and Delete */}
      {menuList && (
        <PopupWindow title={menuList.name} onClose={() => setMenuId(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuId(null), kind: 'secondary' }]}>
          <View style={styles.menu}>
            <Button label="Rename" icon="create-outline" kind="secondary"
                    onPress={() => { setMenuId(null); setRenaming({ id: menuList.id, name: menuList.name }); }} />
            <Button label="Delete" icon="trash-outline" kind="danger" onPress={() => confirmDelete(menuList)} />
          </View>
        </PopupWindow>
      )}

      {/* Rename: the name in a box, then Save (or Cancel to keep it) */}
      {renaming && (
        <PopupWindow title="Rename list" onClose={() => setRenaming(null)}
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

// The page's look, matching the shelf of binders. Each list is a
// rounded, outlined row like the shelf's original binder rows.
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
  message: { fontSize: 15, textAlign: 'center', marginTop: 8 },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS * 1.4, marginTop: 8 },
  emptyPicture: { width: 64, height: 74 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
