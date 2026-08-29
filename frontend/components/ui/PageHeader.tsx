import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { screenStyles } from '@/constants/screenLayout';
import { Colors } from '@/constants/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function PageHeader({ title, subtitle, onBack }: PageHeaderProps) {
  const router = useRouter();

  return (
    <View style={[screenStyles.pageHeader, styles.row]}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        style={screenStyles.backBtn}
      >
        <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.titles}>
        <Text style={screenStyles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexWrap: 'nowrap',
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
