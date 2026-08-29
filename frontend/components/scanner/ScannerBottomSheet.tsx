import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Home } from 'lucide-react-native';

const NAV_GREEN = '#A81F17';

interface ScannerBottomSheetProps {
  instruction: string;
  onShutterPress: () => void;
  hidden?: boolean;
}

export function ScannerBottomSheet({
  instruction,
  onShutterPress,
  hidden = false,
}: ScannerBottomSheetProps) {
  const router = useRouter();

  if (hidden) {
    return null;
  }

  return (
    <View className="rounded-t-[28px] bg-white px-6 pb-8 pt-3 shadow-lg">
      <View className="mb-5 h-1 w-10 self-center rounded-full bg-border" />
      <Text className="mb-12 text-center text-base font-bold text-text-primary">{instruction}</Text>

      <View className="flex-row items-end justify-between px-2">
        <Pressable
          className="min-w-[64px] items-center"
          onPress={() => router.replace('/dashboard')}
        >
          <Home size={22} color={NAV_GREEN} />
          <Text className="mt-1 text-xs font-medium text-text-muted">Home</Text>
        </Pressable>

        <Pressable
          onPress={onShutterPress}
          className="-mt-10 h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-accent-gold bg-white shadow-md active:opacity-90"
        >
          <View className="h-[52px] w-[52px] rounded-full bg-white" />
        </Pressable>

        <View className="min-w-[64px]" />
      </View>
    </View>
  );
}
