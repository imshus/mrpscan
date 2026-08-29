import { Stack } from 'expo-router';

const scannerScreenOptions = { headerShown: false, animation: 'slide_from_right' } as const;
const scannerIndexOptions = { animation: 'fade' } as const;

export default function ScannerLayout() {
  return (
    <Stack screenOptions={scannerScreenOptions}>
      <Stack.Screen name="index" options={scannerIndexOptions} />
      <Stack.Screen name="barcode" />
      <Stack.Screen name="processing" />
      <Stack.Screen name="undetected-abbreviation" />
      <Stack.Screen name="review-results" />
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
      <Stack.Screen name="print-invoice" />
    </Stack>
  );
}
