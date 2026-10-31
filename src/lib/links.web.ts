/* =====================================================================
   OPENING AND SHARING LINKS (on the web)
   The same as links.ts, the browser's way:
   - openLink: open a web page in a new browser tab
   - shareLink: on devices with a built-in share menu (phones' browsers,
     and some desktop browsers) open that menu; otherwise copy the link.
     If even copying is blocked, show the link so it can be copied by
     hand. (The same as the original site.)
   Plain TypeScript with no React in it.
   ===================================================================== */

// What happened when a link was shared (see links.ts)
export type ShareResult = 'shared' | 'copied' | 'none';

// Open a web page in a new tab. "noopener" stops the new page from
// reaching back into this one (a safety habit for links to other sites).
export function openLink(url: string): void {
  window.open(url, '_blank', 'noopener');
}

// Share a link and its title (see above)
export async function shareLink(url: string, title: string): Promise<ShareResult> {
  // The built-in share menu, if this browser has one
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return 'shared';
    } catch (err) {
      // The person closed the share menu: that's fine, do nothing.
      if ((err as Error).name === 'AbortError') return 'none';
      // Any other problem: copy the link instead (below).
    }
  }
  // Copy it; if that's blocked, show it to copy by hand
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    window.prompt('Copy this link to share the card:', url);
    return 'none';
  }
}
