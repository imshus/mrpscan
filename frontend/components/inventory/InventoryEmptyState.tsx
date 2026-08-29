import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FileSpreadsheet, Upload } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface InventoryEmptyStateProps {
  onBulkUpload: () => void;
}

export function InventoryEmptyState({ onBulkUpload }: InventoryEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <FileSpreadsheet size={32} color={Colors.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>No Inventory Items</Text>
      <Text style={styles.subtitle}>
        Click the + button to add new items or upload an Excel sheet to bulk import stock.
      </Text>
      <Pressable onPress={onBulkUpload} style={styles.bulkBtn}>
        <Upload size={16} color={Colors.textPrimary} />
        <Text style={styles.bulkBtnText}>Bulk Upload Stock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F4ECDC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4ECDC',
    borderRadius: Radius.button,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  bulkBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
