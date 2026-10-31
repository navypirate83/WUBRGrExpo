/* =====================================================================
   PICKING A FILE AND READING ITS TEXT
   Opens the device's own file picker (Files on iPhone, the file manager
   on Android, the "Open" window in a browser) and reads the chosen
   file's text, for "Upload .CSV". Expo's "expo-document-picker" opens
   the picker on phones and the web alike.
   Plain TypeScript with no React in it.
   ===================================================================== */

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

// What was picked: the file's name and its text. null if the picker was
// closed without picking anything.
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // .csv files (phones call them by a few names), older .json binder
    // files, and plain text; "copyToCacheDirectory" makes a copy the
    // app is allowed to read
    type: ['text/csv', 'text/comma-separated-values', 'application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  // In a browser the picked file comes with the browser's own File
  // object, which can read its text; on phones it's read from where the
  // picker copied it
  const text = Platform.OS === 'web' && asset.file
    ? await asset.file.text()
    : await new File(asset.uri).text();
  return { name: asset.name, text };
}
