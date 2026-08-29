import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { Colors, Spacing } from '@/constants/theme';

export function InventoryScreenHeader() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <BackgroundPattern />
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
        <ChevronLeft size={24} color={Colors.textPrimary} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>
        Inventory{'\n'}Management
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 34,
  },
});
