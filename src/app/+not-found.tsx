/* =====================================================================
   "NOT FOUND"
   Expo Router shows this for an address that doesn't match any screen
   (the "+" in the file name marks it as special).
   ===================================================================== */

import { Stack } from 'expo-router';
import StillBuilding from '@/components/StillBuilding';

export default function NotFoundScreen() {
  return (
    <>
      {/* The header's title */}
      <Stack.Screen options={{ title: 'Not found' }} />
      <StillBuilding title="Not found" message="There's nothing at this address. Use the tabs to find your way." />
    </>
  );
}
