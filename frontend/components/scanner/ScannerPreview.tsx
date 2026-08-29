import { Text, View } from 'react-native';

import type { ParsedScannerTag } from '@/types/scanner';
import { DIAMOND_SHAPE_LABELS } from '@/constants/diamondShapes';

interface ScannerPreviewProps {
  parsed: ParsedScannerTag | null;
  rawInput: string;
}

const SHAPE_LABELS = DIAMOND_SHAPE_LABELS;

export function ScannerPreview({ parsed, rawInput }: ScannerPreviewProps) {
  if (!rawInput.trim()) return null;

  if (!parsed) {
    return (
      <View className="mb-4 rounded-input border border-danger-text bg-danger-bg px-4 py-3">
        <Text className="text-sm text-danger-text">
          Invalid tag format. Use RD|weight|rate or CS|weight|rate
        </Text>
      </View>
    );
  }

  const typeLabel =
    parsed.stoneType === 'colorstone'
      ? 'Colorstone'
      : SHAPE_LABELS[parsed.shape ?? ''] ?? 'Diamond';

  return (
    <View className="mb-4 rounded-input border border-success bg-success-bg px-4 py-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-success">
        Scanner Preview
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
        <Text className="text-sm text-text-primary">
          Type: <Text className="font-semibold">{typeLabel}</Text>
        </Text>
        <Text className="text-sm text-text-primary">
          Weight: <Text className="font-semibold">{parsed.weight} ct</Text>
        </Text>
        <Text className="text-sm text-text-primary">
          Rate: <Text className="font-semibold">₹{parsed.rate}</Text>
        </Text>
      </View>
    </View>
  );
}
