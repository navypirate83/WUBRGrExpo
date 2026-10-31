/* =====================================================================
   OPENING AND SHARING LINKS (on phones)
   - openLink: open a web page (like a card on Scryfall, or at a store)
     in a browser that slides up inside the app, so closing it brings
     you straight back (expo-web-browser does this)
   - shareLink: open the phone's own Share menu (Messages, Mail,
     "Copy"...) with a link in it (React Native's "Share")
   The web has its own version of this file, links.web.ts, since a
   browser opens links in a new tab and shares by copying.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Platform, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// What happened when a link was shared: the Share menu was used
// ("shared"), the link was copied ("copied", web only), or nothing
// ("none": the menu was closed)
export type ShareResult = 'shared' | 'copied' | 'none';

// Open a web page in the in-app browser. If it can't open, nothing
// happens (there's nothing useful to say about it).
export function openLink(url: string): void {
  WebBrowser.openBrowserAsync(url).catch(() => { /* couldn't open it */ });
}

// Open the Share menu with a link and a title. iPhones take the link on
// its own ("url") and show the title as the message; Android only takes
// a message, so the link goes at the end of it.
export async function shareLink(url: string, title: string): Promise<ShareResult> {
  try {
    const result = await Share.share(
      Platform.OS === 'ios' ? { url, message: title } : { message: `${title}\n${url}`, title },
      { subject: title, dialogTitle: 'Share this card' },
    );
    return result.action === Share.sharedAction ? 'shared' : 'none';
  } catch {
    // The menu couldn't open: nothing else to try on a phone
    return 'none';
  }
}
