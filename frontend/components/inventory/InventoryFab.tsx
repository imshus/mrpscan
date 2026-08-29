import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlusCircle } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

const BUTTON_GREEN = '#A81F17';

interface InventoryFabProps {
  onPress: () => void;
  variant?: 'primary' | 'muted';
}

export function InventoryFab({ onPress, variant = 'primary' }: InventoryFabProps) {
  const isMuted = variant === 'muted';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, isMuted && styles.fabMuted]}
    >
      <View style={[styles.iconWrap, isMuted && styles.iconWrapMuted]}>
        <PlusCircle size={18} color={isMuted ? Colors.textSecondary : Colors.white} />
      </View>
      <Text style={[styles.label, isMuted && styles.labelMuted]}>Add New Inventory</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  fabMuted: {
    backgroundColor: '#F4ECDC',
    shadowOpacity: 0.04,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapMuted: {},
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  labelMuted: {
    color: Colors.textPrimary,
  },
});
