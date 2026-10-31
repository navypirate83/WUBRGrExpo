/* =====================================================================
   THE "NEW BINDER" WINDOW
   A name (the next free "Binder 3" to start, selected so typing replaces
   it), a cover symbol (None to start) and a cover color (black to start).
   Used by The Shelf (its "New binder" button) and the Card Finder ("New
   binder" in the "Add to which binder?" menu). The screen decides what
   happens when "Create binder" is tapped.
   On The Shelf it also has "Upload .CSV": make the binder from a
   binder file saved earlier, or a card list exported from ManaBox (or a
   similar app). An older .json binder file works too.
   ===================================================================== */

import { useState } from 'react';
import { DEFAULT_COVER, NAME_LIMIT, binderFromFile, nextBinderName, type BinderCards } from '@/lib/binderStorage';
import { binderFromCsv } from '@/lib/binderCsv';
import { pickTextFile } from '@/lib/pickFile';
import { showMessage } from '@/lib/dialogs';
import PopupWindow, { type PopupButton } from '@/components/PopupWindow';
import { NameField, SymbolChoices, CoverChoices } from './BinderChoices';

// What an uploaded binder file turns into (see binderFromCsv and binderFromFile)
export type UploadedBinder = ReturnType<typeof binderFromFile> & { cards: BinderCards };

type Props = {
  // "Create binder": the name, the symbol (null for none) and the cover color
  onCreate: (name: string, color: string | null, cover: string) => void;
  // The window closed without making a binder
  onCancel: () => void;
  // Given on The Shelf only: adds the "Upload .CSV" button
  onUpload?: (binder: UploadedBinder) => void;
};

export default function NewBinderDialog({ onCreate, onCancel, onUpload }: Props) {
  // What's typed and picked. (The screen draws this window fresh each
  // time it opens, so these always start from the beginning.)
  const [name, setName] = useState(nextBinderName);
  const [symbol, setSymbol] = useState('');
  const [cover, setCover] = useState(DEFAULT_COVER);
  // Is a file being read right now? (Cards without a Scryfall ID are
  // looked up on Scryfall, which can take a few seconds.)
  const [reading, setReading] = useState(false);

  // "Create binder": hand the name, symbol and cover color to the screen.
  // A blank (or spaces-only) name falls back to the next free name.
  function create() {
    onCreate(name.trim().slice(0, NAME_LIMIT) || nextBinderName(), symbol || null, cover);
  }

  // "Upload .CSV": pick a file and read it. A .json file (or one that
  // starts with "{") is an older binder file; anything else is read as a
  // .csv card list. If it's a binder, hand it to the screen (which
  // closes the window); if not, say why and leave the window open.
  async function upload() {
    if (!onUpload) return;
    setReading(true);
    try {
      const file = await pickTextFile();
      if (!file) return;   // the picker was closed without a file
      const binder = /\.json$/i.test(file.name) || file.text.trimStart().startsWith('{')
        ? binderFromFile(JSON.parse(file.text))
        : await binderFromCsv(file.text, file.name);
      onUpload(binder);
    } catch (err) {
      showMessage('Couldn\'t upload that file', err instanceof SyntaxError ? 'That file isn\'t a readable binder file.' : (err as Error).message);
    } finally {
      setReading(false);
    }
  }

  // The buttons: Upload .CSV (The Shelf only), Cancel, Create binder
  const buttons: PopupButton[] = [
    ...(onUpload ? [{ label: reading ? 'Reading…' : 'Upload .CSV', onPress: upload, kind: 'secondary' as const, disabled: reading }] : []),
    { label: 'Cancel', onPress: onCancel, kind: 'secondary' },
    { label: 'Create binder', onPress: create, kind: 'primary', disabled: reading },
  ];

  return (
    <PopupWindow title="New binder" onClose={onCancel} buttons={buttons}>
      <NameField value={name} onChange={setName} autoFocus onSubmit={create} />
      <SymbolChoices legend="Choose a color symbol for the cover, or none." value={symbol} onChange={setSymbol} />
      <CoverChoices value={cover} onChange={setCover} />
    </PopupWindow>
  );
}
