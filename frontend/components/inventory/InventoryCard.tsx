import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
import type { InventoryFile } from '@/types/inventory';

const ACCENT_GOLD = '#B8860B';
const DELETE_RED = '#A81F17';

interface InventoryCardProps {
  item: InventoryFile;
  onDelete: () => void;
}

export function InventoryCard({ item, onDelete }: InventoryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.itemCount} Items</Text>
          </View>
        </View>
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
          <Trash2 size={18} color={DELETE_RED} />
        </Pressable>
      </View>
      <Text style={styles.timestamp}>
        {item.timeLabel} | {item.dateLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT_GOLD,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  deleteBtn: {
    padding: 4,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 16,
  },
});
