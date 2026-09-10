import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Home, Phone, ScanLine } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomNavRoute } from '@/types/scanner';

import { Colors } from '@/constants/theme';

const NAV_OFFSET = 2;
/**
 * Fallback height of the floating pill, used only for the first frame before
 * onLayout reports the real one. The pill grows with the system font scale, so
 * anything stacked above it must measure rather than trust this number.
 */
export const BOTTOM_NAV_HEIGHT = 72;
/** Distance from the screen bottom to the pill, matching the clamp below. */
export function getBottomNavBottom(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom + NAV_OFFSET, 22);
}
const ICON_SIZE = 22;

interface BottomNavProps {
  activeRoute?: BottomNavRoute | 'none';
  scanButtonVariant?: 'gold' | 'green';
  /** Reports the pill's rendered height so callers can stack content above it. */
  onHeightChange?: (height: number) => void;
}

export function BottomNav({ activeRoute = 'home', onHeightChange }: BottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // navigate, not replace: replace tore down the home screen on the way into
  // the scanner, so coming Home rebuilt it from scratch — a spinner and a
  // rates + credits refetch mid-transition that read as the page hanging.
  // navigate pops back to the screen that is still alive, which is instant;
  // its own focus effect refreshes the numbers in place.
  const handleScannerPress = () => {
    if (activeRoute === 'scanner') {
      return;
    }
    router.navigate('/dashboard/scanner' as Href);
  };

  // Pratham AI is a live call, not a page: the tab dials the voice agent
  // straight away and the screen hangs up when it is left.
  const handlePrathamAiPress = () => {
    if (activeRoute === 'ai') {
      return;
    }
    router.navigate('/dashboard/pratham-ai' as Href);
  };

  const homeColor = activeRoute === 'home' ? Colors.brandDeep : Colors.textMuted;
  const scanColor = activeRoute === 'scanner' ? Colors.brandDeep : Colors.textMuted;
  const aiColor = activeRoute === 'ai' ? Colors.brandDeep : Colors.textMuted;

  return (
    <View
      style={[styles.wrapper, { bottom: Math.max(insets.bottom + NAV_OFFSET, 22) }]}
      onLayout={
        onHeightChange
          ? (event) => onHeightChange(event.nativeEvent.layout.height)
          : undefined
      }
    >
      <View style={styles.navBar}>
        <Pressable style={styles.navItem} onPress={() => router.navigate('/dashboard')}>
          <Home size={ICON_SIZE} color={homeColor} strokeWidth={2} />
          <Text style={[styles.navLabel, { color: homeColor }]}>Home</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={handleScannerPress}>
          <ScanLine size={ICON_SIZE} color={scanColor} strokeWidth={2} />
          <Text style={[styles.navLabel, { color: scanColor }]}>Scanner</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={handlePrathamAiPress}>
          <Phone size={ICON_SIZE} color={aiColor} strokeWidth={2} />
          <Text style={[styles.navLabel, { color: aiColor }]}>Pratham AI</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 28,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 18,
  },
  navLabel: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
});
