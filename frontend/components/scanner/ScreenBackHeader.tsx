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
  /**
   * Header actions, rendered opposite the back arrow (e.g. quick-share icons).
   *
   * They sit on the arrow's row rather than the title's: five 44dp targets and
   * the 28px title cannot share one line on a 360dp screen without the title
   * truncating, and that row is otherwise empty.
   */
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
      <View className="flex-row items-center">
        <Pressable onPress={handleBack} hitSlop={12} className="h-10 w-10 items-center justify-center">
          <ArrowLeft size={24} color={arrowColor} />
        </Pressable>
        <View className="flex-1" />
        {right}
      </View>
      {title ? (
        <Text
          className="mt-2 text-[28px] font-bold leading-[34px] text-text-primary"
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
