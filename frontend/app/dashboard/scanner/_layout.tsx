import { Stack } from 'expo-router';

const scannerScreenOptions = { headerShown: false, animation: 'slide_from_right' } as const;
// Capture -> processing -> review is one scan moving along, not a new page
// each time. They switch at once: a cross-fade showed the two screens
// through each other for a moment, which read as the app going blurry.
const scannerIndexOptions = { animation: 'none' } as const;
const scannerScanStepOptions = { animation: 'none' } as const;

export default function ScannerLayout() {
  return (
    <Stack screenOptions={scannerScreenOptions}>
      <Stack.Screen name="index" options={scannerIndexOptions} />
      <Stack.Screen name="barcode" />
      <Stack.Screen name="processing" options={scannerScanStepOptions} />
      <Stack.Screen name="undetected-abbreviation" />
      <Stack.Screen name="review-results" options={scannerScanStepOptions} />
      <Stack.Screen name="manual-entry" />
      <Stack.Screen name="product-extraction" />
      <Stack.Screen name="data-mapping" />
      <Stack.Screen name="formula-flow" />
      <Stack.Screen name="active-formula-processing" />
      <Stack.Screen name="initial-price-calculation" />
      <Stack.Screen name="scan-results" />
      <Stack.Screen name="formula-management" />
      <Stack.Screen name="formula-execution" />
      <Stack.Screen name="calculation-rules" />
      <Stack.Screen name="invoice-preview" />
    </Stack>
  );
}
