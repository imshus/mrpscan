import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { ScreenBackHeader } from './ScreenBackHeader';
import type { BottomNavRoute } from '@/types/scanner';

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
  const navBottomOffset = insets.bottom - 4;
  const footerBottomOffset = navBottomOffset + 70 + 12;
  const contentBottomPadding = footer
    ? footerBottomOffset + 56 + 24
    : navBottomOffset + 70 + 24;

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
        >
          {footer}
        </View>
      ) : null}
      <BottomNav activeRoute={activeRoute} scanButtonVariant={scanButtonVariant} />
    </SafeAreaView>
  );
}
