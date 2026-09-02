import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

interface ScreenBackHeaderProps {
  title?: string;
  onBack?: () => void;
  fallbackHref?: Href;
  light?: boolean;
  iconColor?: string;
  /** Rendered on the title row, after the title (e.g. quick-share icons). */
  right?: ReactNode;
}

export function ScreenBackHeader({
  title,
  onBack,
  fallbackHref = '/dashboard' as Href,
  light = false,
  iconColor,
  right,
}: ScreenBackHeaderProps) {
  const router = useRouter();
  const arrowColor = iconColor ?? (light ? '#FFFFFF' : '#000000');

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  };

  return (
    <View className={`px-screen pt-2 ${title ? 'pb-3' : ''}`}>
      <Pressable onPress={handleBack} hitSlop={12} className="h-10 w-10 items-center justify-center">
        <ArrowLeft size={24} color={arrowColor} />
      </Pressable>
      {title ? (
        <View className="mt-2 flex-row items-center">
          <Text
            className="flex-1 text-[28px] font-bold leading-[34px] text-text-primary"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {title}
          </Text>
          {right}
        </View>
      ) : null}
    </View>
  );
}
