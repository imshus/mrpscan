import { Text, View } from 'react-native';

import { BRAND } from '@/constants/dummyData';

interface PrathamLogoProps {
  size?: 'large' | 'medium';
}

export function PrathamLogo({ size = 'large' }: PrathamLogoProps) {
  const isLarge = size === 'large';
  return (
    <View className="items-center">
      <Text
        className={`font-bold tracking-wide text-primary ${isLarge ? 'text-[32px]' : 'text-2xl'}`}
      >
        {BRAND.name}
      </Text>
      <Text
        className={`mt-0.5 text-center text-primary ${isLarge ? 'text-base' : 'text-sm'}`}
        numberOfLines={1}
      >
        {BRAND.tagline}
      </Text>
    </View>
  );
}
