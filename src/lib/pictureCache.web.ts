/* =====================================================================
   CARD PICTURES ON THE WEBSITE
   The phone app saves card pictures itself, with a size limit (see
   pictureCache.ts). A web browser keeps its own copies of pictures it
   has downloaded and doesn't let a website choose how much space they
   take, so there's nothing to do here: these do nothing, and exist so
   the rest of the app can ask the same questions on both.
   Plain TypeScript with no React in it.
   ===================================================================== */

// The size limit (only used on phones; here for the same shape)
export const MAX_PICTURE_BYTES = 0;

export async function loadPictureCache(): Promise<void> { /* the browser does it */ }

export function pictureCacheStats(): { count: number; bytes: number; limit: number } {
  return { count: 0, bytes: 0, limit: 0 };
}

export async function savePicturesNow(
  _urls: string[],
  _onProgress: (done: number, total: number) => void,
): Promise<{ saved: number; failed: number; stoppedEarly: boolean }> {
  return { saved: 0, failed: 0, stoppedEarly: false };
}

export async function clearPictureCache(): Promise<void> { /* the browser does it */ }
