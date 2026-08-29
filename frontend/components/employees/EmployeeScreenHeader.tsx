import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Colors, Spacing } from '@/constants/theme';

interface EmployeeScreenHeaderProps {
  title: string;
  multiline?: boolean;
}

export function EmployeeScreenHeader({ title }: EmployeeScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
        <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
      </Pressable>
      <Text style={styles.title}>{title.replace(/\n/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 18,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
