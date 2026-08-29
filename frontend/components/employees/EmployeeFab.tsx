import { Pressable, StyleSheet, Text } from 'react-native';
import { PlusCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';

interface EmployeeFabProps {
  onPress: () => void;
  variant?: 'primary' | 'muted';
  label?: string;
}

export function EmployeeFab({
  onPress,
  variant = 'primary',
  label = 'Add New Employee',
}: EmployeeFabProps) {
  const isMuted = variant === 'muted';
  const insets = useSafeAreaInsets();

  if (isMuted) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.fab,
          styles.fabMuted,
          { position: 'absolute', right: -2, bottom: insets.bottom + 3 },
        ]}
      >
        <PlusCircle size={18} color={Colors.textSecondary} />
        <Text style={[styles.label, styles.labelMuted]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{ position: 'absolute', right: -2, bottom: insets.bottom + 3 }}
    >
      <GradientView colors={Gradients.brand} borderRadius={999} style={styles.fab}>
        <PlusCircle size={18} color={Colors.white} />
        <Text style={styles.label}>{label}</Text>
      </GradientView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 8,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 6,
  },
  fabMuted: {
    backgroundColor: Colors.backgroundAlt,
    shadowOpacity: 0.04,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  labelMuted: {
    color: Colors.textPrimary,
  },
});
