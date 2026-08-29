import { View } from 'react-native';

import { SCANNER_FRAME_HEIGHT, SCANNER_FRAME_WIDTH } from './ScannerScreenLayout';

const CORNER_SIZE = 28;
const CORNER_WIDTH = 3;

function Corner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = {
    position: 'absolute' as const,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#B8860B',
  };

  const styles = {
    tl: { ...base, top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
    tr: { ...base, top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
    bl: { ...base, bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
    br: { ...base, bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  };

  return <View style={styles[position]} />;
}

export function QROverlay() {
  const size = Math.min(SCANNER_FRAME_WIDTH, SCANNER_FRAME_HEIGHT + 80);

  return (
    <View style={{ width: size, height: size }} className="relative">
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />
    </View>
  );
}
