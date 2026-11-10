/* =====================================================================
   SETTINGS → CARD PICTURES (phone app only)
   Card pictures are saved on the phone the first time they're shown, so
   they open instantly, use no data and work with no internet (see
   lib/pictureCache.ts). This section shows how much space they take
   (the limit is 3 GB, and the ones not looked at for the longest time
   are removed first) and has two buttons:
   - "Save all my binder pictures": downloads every picture for the
     cards in your binders and lists now (on Wi-Fi is wise), so
     everything works offline
   - "Clear saved pictures": deletes them all to free space (they
     download again whenever they're shown)
   The website shows nothing here: browsers look after their own pictures.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { loadBinder, loadBinderList } from '@/lib/binderStorage';
import { loadLists } from '@/lib/listStorage';
import { CARD_BACK } from '@/lib/cards';
import { askYesNo, showMessage } from '@/lib/dialogs';
import { clearPictureCache, pictureCacheStats, savePicturesNow } from '@/lib/pictureCache';
import { SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import { SettingRow, SettingsSection } from './SettingsParts';

// A size in bytes as words: "412 MB", "1.3 GB"
function sizeText(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

// The address of the picture of every card in every binder and list on
// this device, plus the card back (shown while a picture loads)
function everyPictureWanted(): string[] {
  const urls = new Set<string>([CARD_BACK]);
  for (const binder of loadBinderList()) {
    for (const card of Object.values(loadBinder(binder.id))) if (card.image) urls.add(card.image);
  }
  for (const list of loadLists()) {
    for (const card of list.cards) if (card.image) urls.add(card.image);
  }
  return [...urls];
}

export default function PicturesSection() {
  // How much is saved right now (looked at again every couple of seconds,
  // because pictures keep arriving in the background)
  const [stats, setStats] = useState(pictureCacheStats());
  useEffect(() => {
    const timer = setInterval(() => setStats(pictureCacheStats()), 2000);
    return () => clearInterval(timer);
  }, []);

  // Set while "Save all" runs: how far along it is (null = not running)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Not on the website
  if (Platform.OS === 'web') return null;

  async function saveAll() {
    const total = everyPictureWanted().length;
    const sure = await askYesNo(
      'Save all pictures?',
      `This downloads up to ${total.toLocaleString()} card pictures to this phone so they work with no internet. ` +
      'It uses mobile data if you are not on Wi-Fi.',
      'Save', 'Cancel',
    );
    if (!sure) return;
    setProgress({ done: 0, total });
    try {
      const result = await savePicturesNow(everyPictureWanted(), (done, of) => setProgress({ done, total: of }));
      setStats(pictureCacheStats());
      showMessage(
        'Pictures saved',
        result.stoppedEarly
          ? 'Stopped early: the 3 GB limit was reached or this phone is nearly out of space.'
          : result.failed > 0
            ? `${result.saved.toLocaleString()} saved. ${result.failed.toLocaleString()} couldn't be downloaded (check your connection and try again).`
            : 'Every picture in your binders and lists is now saved on this phone.',
      );
    } finally {
      setProgress(null);
    }
  }

  async function clearAll() {
    const sure = await askYesNo(
      'Clear saved pictures?',
      'The saved card pictures are deleted from this phone to free space. They download again whenever they are shown. Your binders are not touched.',
      'Clear', 'Cancel',
    );
    if (!sure) return;
    await clearPictureCache();
    setStats(pictureCacheStats());
  }

  return (
    <SettingsSection title="Card pictures">
      <SettingRow
        name="Saved pictures"
        description={
          `Card pictures are saved on this phone the first time you see them, so they open instantly and work with no internet. ` +
          `Using ${sizeText(stats.bytes)} (${stats.count.toLocaleString()} pictures) of the ${sizeText(stats.limit)} limit. ` +
          'When it is full, the pictures you have not looked at for the longest time are removed first.'
        }
      />
      <View style={styles.buttons}>
        <Button
          label={progress ? `Saving ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}…` : 'Save all my binder pictures'}
          kind="secondary"
          icon="download-outline"
          onPress={saveAll}
          disabled={progress !== null}
        />
        <Button label="Clear saved pictures" kind="secondary" icon="trash-outline" onPress={clearAll} disabled={progress !== null} />
      </View>
    </SettingsSection>
  );
}

// The buttons: with room around them
const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.m, padding: SPACE.m },
});
