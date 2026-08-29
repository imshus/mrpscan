import { Text, View } from 'react-native';

import { SCANNER_FRAME_HEIGHT, SCANNER_FRAME_WIDTH } from './ScannerScreenLayout';

const HANDLE = 10;

export function OCROverlay() {
  return (
    <View
      style={{ width: SCANNER_FRAME_WIDTH, height: SCANNER_FRAME_HEIGHT + 40 }}
      className="relative items-center justify-center rounded-lg border-2 border-dashed border-white/80 bg-black/10"
    >
      <Text className="text-xs font-semibold tracking-widest text-white/90">ALIGN TEXT HERE</Text>

      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <View
          key={corner}
          className="absolute bg-white/70"
          style={{
            width: HANDLE,
            height: HANDLE,
            top: corner.startsWith('t') ? -HANDLE / 2 : undefined,
            bottom: corner.startsWith('b') ? -HANDLE / 2 : undefined,
            left: corner.endsWith('l') ? -HANDLE / 2 : undefined,
            right: corner.endsWith('r') ? -HANDLE / 2 : undefined,
          }}
        />
      ))}
    </View>
  );
}
