import { Text, View } from 'react-native';

import { useScannerStore } from '@/store/scannerStore';

export function ItemSelectedBadge() {
  const selectedType = useScannerStore((s) => s.selectedType);
  const scanMode = useScannerStore((s) => s.scanMode);
  const scanSide = useScannerStore((s) => s.scanSide);

  const sideLabel =
    scanMode === 'both' ? (scanSide === 'front' ? 'Front Side' : 'Back Side') : null;

  return (
    <View className="self-center rounded-xl bg-black/50 px-4 py-2">
      <Text className="text-sm text-white">
        Item Selected : <Text className="font-semibold text-accent-gold">{selectedType}</Text>
      </Text>
      {/* {sideLabel ? ( */}
      <Text className="mt-1 text-center text-xs text-white/80">Scanning: {sideLabel}</Text>
      {/* // ) : null} */}
    </View>
  );
}
