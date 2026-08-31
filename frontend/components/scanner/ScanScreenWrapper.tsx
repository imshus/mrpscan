import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BOTTOM_NAV_HEIGHT,
  BottomNav,
  getBottomNavBottom,
} from '@/components/dashboard/BottomNav';
import { ScreenBackHeader } from './ScreenBackHeader';
import type { BottomNavRoute } from '@/types/scanner';

/**
 * Clear space between a footer button and the top of the nav pill.
 *
 * It has to cover more than the visual gap: the pill carries a large soft
 * shadow (radius 30, elevation 12) that bleeds upwards, so a button sitting
 * only a few pixels above still reads as tucked inside the nav. Raise this
 * number to lift every footer button further off the nav.
 */
const FOOTER_GAP_ABOVE_NAV = 26;

interface ScanScreenWrapperProps {
  title: string;
  children: React.ReactNode;
  activeRoute?: BottomNavRoute;
  scanButtonVariant?: 'gold' | 'green';
  footer?: React.ReactNode;
  onBack?: () => void;
  className?: string;
}

export function ScanScreenWrapper({
  title,
  children,
  activeRoute = 'scanner',
  scanButtonVariant = 'gold',
  footer,
  onBack,
  className = 'bg-white',
}: ScanScreenWrapperProps) {
  const insets = useSafeAreaInsets();

  // Both the nav pill and the footer button grow with the system font scale, so
  // their heights are measured rather than assumed. Hard-coded guesses put the
  // footer underneath the pill once the user enlarged their font.
  const [navHeight, setNavHeight] = useState(BOTTOM_NAV_HEIGHT);
  const [footerHeight, setFooterHeight] = useState(64);

  // Round before comparing so a sub-pixel layout pass cannot loop forever.
  const measure = (current: number, next: number, apply: (value: number) => void) => {
    const rounded = Math.round(next);
    if (rounded > 0 && rounded !== Math.round(current)) apply(rounded);
  };

  const handleNavLayout = useCallback(
    (height: number) => measure(navHeight, height, setNavHeight),
    [navHeight],
  );

  // The nav clamps its own position, so derive the footer from that same
  // value: computing it from raw insets let the footer sit inside the pill on
  // devices with little or no bottom inset.
  const navTop = getBottomNavBottom(insets.bottom) + navHeight;
  const footerBottomOffset = navTop + FOOTER_GAP_ABOVE_NAV;
  const contentBottomPadding = footer
    ? footerBottomOffset + footerHeight + 24
    : navTop + 24;

  return (
    <SafeAreaView className={`flex-1 ${className}`} edges={['top']}>
      <ScreenBackHeader title={title} onBack={onBack} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-screen pt-1"
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          className="absolute left-0 right-0 px-screen"
          style={{ bottom: footerBottomOffset }}
          onLayout={(event) =>
            measure(footerHeight, event.nativeEvent.layout.height, setFooterHeight)
          }
        >
          {footer}
        </View>
      ) : null}
      <BottomNav
        activeRoute={activeRoute}
        scanButtonVariant={scanButtonVariant}
        onHeightChange={handleNavLayout}
      />
    </SafeAreaView>
  );
}
