/* =====================================================================
   HOLDING CTRL TO PICK SEVERAL THINGS (on phones: nothing)
   On a computer, holding Ctrl and clicking picks several binders at once:
   see useCtrlSelect.web.ts. Phones have no Ctrl key, so this version does
   nothing ("ctrlHeld" is always false). Screens can call it the same way
   on every device.
   ===================================================================== */

import { useRef, type MutableRefObject } from 'react';

export function useCtrlSelect(_onRelease: () => void, _onEscape: () => void): { ctrlHeld: MutableRefObject<boolean> } {
  // Never true: there's no Ctrl key to hold
  const ctrlHeld = useRef(false);
  return { ctrlHeld };
}
