/* =====================================================================
   KEEPING THIS DEVICE AND THE WUBRG'R SERVER THE SAME
   The device keeps the working copy of your binders and lists (so the app
   works with no internet). When you're signed in, syncWithServer():
   1. SENDS what changed on this device. A binder or list that isn't on
      the server yet is created there (this is also how the binders you
      already had are moved up the first time you sign in).
   2. BRINGS DOWN what is on the server and not here: a binder made on
      another phone, or one whose cards changed there.
   3. If you deleted a binder or list here, it's deleted on the server.
      If it was deleted on another device, it's removed here (but only if
      you hadn't changed it since).
   How it knows what changed: after each sync it remembers a short
   "fingerprint" of every binder and list (a number worked out from its
   name, look and cards). A different fingerprint now means a change since
   the last sync. It also remembers each item's "version" time from the
   server, so a newer version from another device is noticed.
   If the same binder changed in both places, THIS device wins (the last
   device to sync keeps its changes). Nothing is ever deleted by guessing:
   a binder that is on the server but unknown here is brought down, and a
   name that is already taken gets a number added. The exception: a binder
   or list on the server with the same name AND exactly the same cards is
   the same one (for example after the browser's saved data was cleared),
   so it is linked up instead of copied. The links are kept for each
   account on this device, so logging out and in again is quick.
   Having no internet isn't a problem: it just tries again later.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { apiRequest, isOffline } from './api';
import { getServerUser, isServerSignedIn } from './session';
import {
  cleanCover, cleanPageCount, forgetBinder, freeBinderName, loadBinder, loadBinderList, newLocalBinderId,
  pocketKey, saveBinder, saveBinderList, setLocalMode, type Binder, type BinderCard, type BinderCards,
} from './binderStorage';
import {
  forgetList, loadLists, newLocalListId, saveLists, type CardList, type ListCard,
} from './listStorage';
import { storageGet, storageSet } from './storage';

/* ---------- what we remember between syncs ---------- */

// For one binder or list: its id on the server, its fingerprint when we
// last synced it, and the server's "version" time then
type Link = { serverId: string; fingerprint: string; version: string };
type Memory = { binders: Record<string, Link>; lists: Record<string, Link> };

// Each account has its own memory on this device, so logging out and in
// again (even as someone else in between) never mixes links up, and a
// later login doesn't have to compare and re-send everything
function memoryKey(): string {
  return `serverSync:${getServerUser()?.id ?? 'nobody'}`;
}

function readMemory(): Memory {
  try {
    const saved = JSON.parse(storageGet(memoryKey()) ?? 'null');
    if (saved && typeof saved === 'object') return { binders: saved.binders ?? {}, lists: saved.lists ?? {} };
  } catch { /* unreadable: start fresh */ }
  return { binders: {}, lists: {} };
}
function writeMemory(memory: Memory): void {
  storageSet(memoryKey(), JSON.stringify(memory));
}

// A short number worked out from some text. The same text always gives
// the same number; a different text almost always a different one.
function fingerprintOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${hash}`;
}

/* ---------- turning cards into what the server wants, and back ---------- */

// What the server sends for a binder or list
type ServerItem = { _id: string; name: string; color?: string | null; cover?: string; pages?: number; updatedAt: string };
type ServerCard = BinderCard & { page: number; pocket: number; manaCost?: string; typeLine?: string };

// A card as the server stores it: the pocket becomes page and pocket numbers
function cardToServer(key: string, card: BinderCard): Record<string, unknown> {
  const [page, pocket] = key.split('-').map(Number);
  return { page, pocket, ...card };
}

// A card from the server, without the fields our app doesn't keep
function cardFromServer(card: ServerCard): BinderCard {
  const out: BinderCard = { name: card.name, set: card.set ?? '', number: card.number ?? '', face: card.face ?? 0, image: card.image };
  if (card.lang) out.lang = card.lang;
  if (card.count && card.count > 1) out.count = card.count;
  if (card.foil) out.foil = true;
  if (card.added) out.added = new Date(card.added).toISOString();
  if (card.extra && Object.keys(card.extra).length > 0) out.extra = card.extra;
  return out;
}

// The look of a binder, as the server wants it
function detailsToServer(binder: Binder) {
  return { name: binder.name, color: binder.color ?? null, cover: binder.cover, pages: binder.pages };
}

// Every page of a server list (the server sends at most 100 at a time)
async function getAll<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page < 200; page++) {
    const batch = await apiRequest<T[]>(`${path}?page=${page}&limit=100`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/* ---------- binders ---------- */

async function syncBinders(memory: Memory): Promise<void> {
  const onServer = await getAll<ServerItem>('/binders');
  const serverById = new Map(onServer.map((item) => [item._id, item]));
  const knownServerIds = new Set(Object.values(memory.binders).map((link) => link.serverId));

  // 1. Every binder on this device: send it, or update it from the server
  for (const binder of [...loadBinderList()]) {
    const cards = loadBinder(binder.id);
    const fingerprint = fingerprintOf([detailsToServer(binder), cards]);
    const link = memory.binders[binder.id];
    const remote = link ? serverById.get(link.serverId) : undefined;

    // Not on the server yet (new here, or deleted on the server)
    if (!remote) {
      // It was on the server before and nothing here has changed since:
      // it was deleted on another device, so remove it here too
      if (link && link.fingerprint === fingerprint) {
        forgetBinder(binder.id);
        delete memory.binders[binder.id];
        continue;
      }
      // Never linked, but the server already has this very binder (same
      // name, same cards)? That happens after logging out and in again,
      // which forgets the links. Link them up instead of making a copy.
      const twin = link ? undefined : await findBinderTwin(binder, cards, onServer, memory);
      if (twin) {
        await linkBinderTwin(binder, cards, twin, memory);
        continue;
      }
      await createBinderOnServer(binder, cards, memory);
      continue;
    }

    const changedHere = !link || link.fingerprint !== fingerprint;
    const changedThere = remote.updatedAt !== link?.version;
    if (changedHere) {
      // This device wins (also when both changed)
      await pushBinder(binder, cards, remote._id, memory);
    } else if (changedThere) {
      await pullBinder(binder.id, remote, memory);
    }
  }

  // 2. Binders on the server this device has never seen: bring them down
  for (const remote of onServer) {
    if (knownServerIds.has(remote._id)) continue;
    // (A binder just created above is already known)
    if (Object.values(memory.binders).some((link) => link.serverId === remote._id)) continue;
    await pullNewBinder(remote, memory);
  }

  // 3. Binders deleted on this device: delete them on the server
  const stillHere = new Set(loadBinderList().map((b) => b.id));
  for (const [localId, link] of Object.entries(memory.binders)) {
    if (stillHere.has(localId)) continue;
    await apiRequest(`/binders/${link.serverId}`, { method: 'DELETE' }).catch((err) => {
      // Already gone on the server is fine
      if ((err as { status?: number }).status !== 404) throw err;
    });
    delete memory.binders[localId];
  }
}

// The same text for the same card, whatever order its fields were written
// in (so two copies of one card always compare as equal)
function stableText(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v);
}

// Do two binders hold exactly the same cards in the same pockets?
// (Ours is first turned into the shape the server gives back.)
function sameCards(mine: BinderCards, theirs: BinderCards): boolean {
  const keys = Object.keys(mine);
  if (keys.length !== Object.keys(theirs).length) return false;
  return keys.every((key) => {
    const other = theirs[key];
    if (!other) return false;
    const mineAsServerSendsIt = cardFromServer(cardToServer(key, mine[key]) as unknown as ServerCard);
    return stableText(mineAsServerSendsIt) === stableText(other);
  });
}

// A binder on the server that is the same one as this device's binder: it
// has the same name, holds the same cards, and isn't linked to anything
// here yet. Returns nothing if there isn't one.
async function findBinderTwin(binder: Binder, cards: BinderCards, onServer: ServerItem[], memory: Memory): Promise<ServerItem | undefined> {
  const linked = new Set(Object.values(memory.binders).map((link) => link.serverId));
  for (const remote of onServer) {
    if (linked.has(remote._id) || remote.name.toLowerCase() !== binder.name.toLowerCase()) continue;
    if (sameCards(cards, await downloadCards(`/binders/${remote._id}/cards`))) return remote;
  }
  return undefined;
}

// Link a binder to its twin on the server. The cards are already the same,
// so nothing is sent unless the look (name, color, cover, pages) differs.
async function linkBinderTwin(binder: Binder, cards: BinderCards, twin: ServerItem, memory: Memory): Promise<void> {
  const sameLook = stableText(detailsToServer(withDetails(binder, twin))) === stableText(detailsToServer(binder));
  if (!sameLook) {
    await pushBinder(binder, cards, twin._id, memory);
    return;
  }
  memory.binders[binder.id] = { serverId: twin._id, fingerprint: fingerprintOf([detailsToServer(binder), cards]), version: twin.updatedAt };
}

// Make a binder on the server, then send its cards. If the name is taken
// there, a number is added to the name (here too), so nothing is overwritten.
async function createBinderOnServer(binder: Binder, cards: BinderCards, memory: Memory): Promise<void> {
  let details = detailsToServer(binder);
  let created: ServerItem;
  try {
    created = await apiRequest<ServerItem>('/binders', { method: 'POST', body: details });
  } catch (err) {
    if ((err as { status?: number }).status !== 409) throw err;
    const taken = new Set((await getAll<ServerItem>('/binders')).map((item) => item.name.toLowerCase()));
    let n = 2;
    let name = binder.name;
    while (taken.has(name.toLowerCase())) name = `${binder.name.slice(0, 12 - String(n).length - 1)} ${n++}`;
    details = { ...details, name };
    created = await apiRequest<ServerItem>('/binders', { method: 'POST', body: details });
    binder = { ...binder, name };
    saveBinderList(loadBinderList().map((b) => (b.id === binder.id ? binder : b)));
  }
  await pushBinder(binder, cards, created._id, memory);
}

// Send a binder's details and cards, then remember how it looked
async function pushBinder(binder: Binder, cards: BinderCards, serverId: string, memory: Memory): Promise<void> {
  await apiRequest(`/binders/${serverId}`, { method: 'PUT', body: detailsToServer(binder) });
  await apiRequest(`/binders/${serverId}/cards`, {
    method: 'PUT',
    body: { cards: Object.entries(cards).map(([key, card]) => cardToServer(key, card)) },
  });
  const after = await apiRequest<ServerItem>(`/binders/${serverId}`);
  memory.binders[binder.id] = {
    serverId,
    fingerprint: fingerprintOf([detailsToServer(binder), cards]),
    version: after.updatedAt,
  };
}

// Bring a changed binder's details and cards down over the device's copy
async function pullBinder(localId: string, remote: ServerItem, memory: Memory): Promise<void> {
  const cards = await downloadCards(`/binders/${remote._id}/cards`);
  saveBinder(cards, localId, { dirty: false });
  const list = loadBinderList().map((b) => (b.id === localId ? withDetails(b, remote) : b));
  saveBinderList(list);
  const updated = list.find((b) => b.id === localId)!;
  memory.binders[localId] = { serverId: remote._id, fingerprint: fingerprintOf([detailsToServer(updated), cards]), version: remote.updatedAt };
}

// Bring a binder this device has never seen down as a new binder
async function pullNewBinder(remote: ServerItem, memory: Memory): Promise<void> {
  const cards = await downloadCards(`/binders/${remote._id}/cards`);
  const id = newLocalBinderId();
  const binder: Binder = { ...withDetails({ id, name: freeBinderName(remote.name), color: null, cover: '', pages: 0 }, remote), name: freeBinderName(remote.name) };
  saveBinder(cards, id, { dirty: false });
  saveBinderList([...loadBinderList(), binder]);
  memory.binders[id] = { serverId: remote._id, fingerprint: fingerprintOf([detailsToServer(binder), cards]), version: remote.updatedAt };
}

// A binder's details taken from what the server says (checked on the way in)
function withDetails(binder: Binder, remote: ServerItem): Binder {
  return {
    ...binder,
    name: remote.name,
    color: remote.color ?? null,
    cover: cleanCover(remote.cover),
    pages: cleanPageCount(remote.pages),
  };
}

// A binder's cards from the server, as the device keeps them
async function downloadCards(path: string): Promise<BinderCards> {
  const cards: BinderCards = {};
  for (const card of await apiRequest<ServerCard[]>(path)) {
    cards[pocketKey(card.page, card.pocket)] = cardFromServer(card);
  }
  return cards;
}

/* ---------- lists ---------- */

async function syncLists(memory: Memory): Promise<void> {
  const onServer = await getAll<ServerItem>('/lists');
  const serverById = new Map(onServer.map((item) => [item._id, item]));
  let lists = loadLists();

  // 1. Every list on this device
  for (const list of [...lists]) {
    const fingerprint = fingerprintOf([list.name, list.cards]);
    const link = memory.lists[list.id];
    const remote = link ? serverById.get(link.serverId) : undefined;

    if (!remote) {
      if (link && link.fingerprint === fingerprint) {
        // Deleted on another device and unchanged here: remove it here
        lists = lists.filter((l) => l.id !== list.id);
        forgetList(list.id);
        delete memory.lists[list.id];
        continue;
      }
      // Never linked, but the server already has this very list (same
      // name, same cards): link them up instead of making a copy
      const twin = link ? undefined : await findListTwin(list, onServer, memory);
      if (twin && twin.name === list.name) {
        // Exactly the same name and cards: just link them, nothing to send
        memory.lists[list.id] = { serverId: twin._id, fingerprint, version: twin.updatedAt };
        continue;
      }
      const target = twin ?? await createListOnServer(list);
      await pushList(list, target._id, memory);
      continue;
    }

    const changedHere = !link || link.fingerprint !== fingerprint;
    const changedThere = remote.updatedAt !== link?.version;
    if (changedHere) await pushList(list, remote._id, memory);
    else if (changedThere) await pullList(list.id, remote, memory);
  }

  // 2. Lists on the server this device has never seen
  const known = new Set(Object.values(memory.lists).map((link) => link.serverId));
  for (const remote of onServer) {
    if (known.has(remote._id)) continue;
    const cards = await apiRequest<ServerCard[]>(`/lists/${remote._id}/cards`);
    const id = newLocalListId();
    const added: CardList = { id, name: uniqueListName(remote.name), cards: cards.map(listCardFromServer) };
    saveLists([...loadLists(), added]);
    memory.lists[id] = { serverId: remote._id, fingerprint: fingerprintOf([added.name, added.cards]), version: remote.updatedAt };
  }

  // 3. Lists deleted on this device
  const stillHere = new Set(loadLists().map((l) => l.id));
  for (const [localId, link] of Object.entries(memory.lists)) {
    if (stillHere.has(localId)) continue;
    await apiRequest(`/lists/${link.serverId}`, { method: 'DELETE' }).catch((err) => {
      if ((err as { status?: number }).status !== 404) throw err;
    });
    delete memory.lists[localId];
  }
}

// A list card from the server
function listCardFromServer(card: ServerCard): ListCard {
  return { ...cardFromServer(card), manaCost: card.manaCost ?? '', typeLine: card.typeLine ?? '' };
}

// A list name not already used on this device
function uniqueListName(name: string): string {
  const taken = new Set(loadLists().map((l) => l.name.toLowerCase()));
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} ${n}`;
  return candidate;
}

// A list on the server that is the same one as this device's list: same
// name, same cards (in any order), not linked to anything here yet
async function findListTwin(list: CardList, onServer: ServerItem[], memory: Memory): Promise<ServerItem | undefined> {
  const linked = new Set(Object.values(memory.lists).map((link) => link.serverId));
  const mine = list.cards.map((card) => stableText(listCardFromServer(card as unknown as ServerCard))).sort().join('|');
  for (const remote of onServer) {
    if (linked.has(remote._id) || remote.name.toLowerCase() !== list.name.toLowerCase()) continue;
    const theirs = (await apiRequest<ServerCard[]>(`/lists/${remote._id}/cards`)).map((card) => stableText(listCardFromServer(card))).sort().join('|');
    if (mine === theirs) return remote;
  }
  return undefined;
}

// Make a list on the server (a number is added to the name if it's taken)
async function createListOnServer(list: CardList): Promise<ServerItem> {
  try {
    return await apiRequest<ServerItem>('/lists', { method: 'POST', body: { name: list.name } });
  } catch (err) {
    if ((err as { status?: number }).status !== 409) throw err;
    const taken = new Set((await getAll<ServerItem>('/lists')).map((item) => item.name.toLowerCase()));
    let n = 2;
    let name = list.name;
    while (taken.has(name.toLowerCase())) name = `${list.name} ${n++}`;
    saveLists(loadLists().map((l) => (l.id === list.id ? { ...l, name } : l)));
    return apiRequest<ServerItem>('/lists', { method: 'POST', body: { name } });
  }
}

async function pushList(list: CardList, serverId: string, memory: Memory): Promise<void> {
  const current = loadLists().find((l) => l.id === list.id) ?? list;
  await apiRequest(`/lists/${serverId}`, { method: 'PUT', body: { name: current.name } });
  await apiRequest(`/lists/${serverId}/cards`, { method: 'PUT', body: { cards: current.cards } });
  const after = await apiRequest<ServerItem>(`/lists/${serverId}`);
  memory.lists[list.id] = { serverId, fingerprint: fingerprintOf([current.name, current.cards]), version: after.updatedAt };
}

async function pullList(localId: string, remote: ServerItem, memory: Memory): Promise<void> {
  const cards = (await apiRequest<ServerCard[]>(`/lists/${remote._id}/cards`)).map(listCardFromServer);
  const lists = loadLists().map((l) => (l.id === localId ? { ...l, name: remote.name, cards } : l));
  saveLists(lists);
  memory.lists[localId] = { serverId: remote._id, fingerprint: fingerprintOf([remote.name, cards]), version: remote.updatedAt };
}

/* ---------- running a sync ---------- */

// Is a sync running right now? (A second request waits for the same one.)
let running: Promise<void> | null = null;

// Make the device and the server match, as described at the top.
// Throws if the server can't be reached (callers use syncQuietly).
export function syncWithServer(): Promise<void> {
  if (!isServerSignedIn()) return Promise.resolve();
  if (!running) {
    running = (async () => {
      const memory = readMemory();
      // The app's screens work from the device's copy: make sure the
      // binders show even though nobody "signed in with Google"
      setLocalMode(true);
      try {
        await syncBinders(memory);
        await syncLists(memory);
      } finally {
        // Remember how far we got, even if something failed half way
        writeMemory(memory);
      }
    })().finally(() => { running = null; });
  }
  return running;
}

// Sync, but never throw: no internet just means "later". Returns an
// error message for anything else, or null if all went well.
export async function syncQuietly(): Promise<string | null> {
  try {
    await syncWithServer();
    return null;
  } catch (err) {
    return isOffline(err) ? null : (err as Error).message;
  }
}

// Has anything on this device changed since the last sync? (Cheap: no
// internet needed.) Used to sync soon after you make a change.
export function changedSinceSync(): boolean {
  const memory = readMemory();
  for (const binder of loadBinderList()) {
    const link = memory.binders[binder.id];
    if (!link || link.fingerprint !== fingerprintOf([detailsToServer(binder), loadBinder(binder.id)])) return true;
  }
  for (const list of loadLists()) {
    const link = memory.lists[list.id];
    if (!link || link.fingerprint !== fingerprintOf([list.name, list.cards])) return true;
  }
  const hereBinders = new Set(loadBinderList().map((b) => b.id));
  const hereLists = new Set(loadLists().map((l) => l.id));
  return Object.keys(memory.binders).some((id) => !hereBinders.has(id))
    || Object.keys(memory.lists).some((id) => !hereLists.has(id));
}
